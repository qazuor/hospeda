/**
 * Unit Tests: Alerts & Offers Daily Digest Cron Job (SPEC-286 T-007)
 *
 * Mocking strategy: mirrors conversation-notification.job.test.ts — mocks
 * `@repo/service-core`, `@repo/db`, and `@repo/notifications` so no real DB
 * or email provider is touched. Cron jobs are plain `CronJobDefinition`
 * objects (not classes), so there is no constructor to inject a deps object
 * through — dependency substitution happens via `vi.mock()` of the imported
 * modules, matching the established convention for every other cron job
 * test in this directory.
 *
 * Test Coverage:
 * - Job metadata (name, schedule, enabled, timeoutMs).
 * - HOSPEDA_EMAIL_API_KEY unset → skipped result, no evaluator/model calls.
 * - No qualifying users → success with processed = 0.
 * - Dry-run mode → no delivery call, `details.wouldProcess` reflects the count.
 * - Per-user error isolation: a missing user does not prevent other users
 *   in the same run from receiving their digest.
 * - Successful delivery path: `deliverBatch` invoked once per 50-user chunk.
 * - Unhandled exception → failure result.
 *
 * @module test/cron/alerts-digest
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
    mockEvaluatePriceDrops,
    mockEvaluatePromoOffers,
    mockFindByIds,
    mockDeliverBatch,
    mockEnv
} = vi.hoisted(() => ({
    mockEvaluatePriceDrops: vi.fn(),
    mockEvaluatePromoOffers: vi.fn(),
    mockFindByIds: vi.fn(),
    mockDeliverBatch: vi.fn().mockResolvedValue(undefined),
    mockEnv: {
        HOSPEDA_EMAIL_API_KEY: 'test-brevo-key' as string | undefined,
        HOSPEDA_EMAIL_FROM_EMAIL: 'noreply@hospeda.test',
        HOSPEDA_EMAIL_FROM_NAME: 'Hospeda Test'
    }
}));

vi.mock('@repo/service-core', () => ({
    PriceDropEvaluatorService: vi.fn().mockImplementation(() => ({
        evaluatePriceDrops: mockEvaluatePriceDrops
    })),
    PromoOfferEvaluatorService: vi.fn().mockImplementation(() => ({
        evaluatePromoOffers: mockEvaluatePromoOffers
    }))
}));

vi.mock('@repo/db', () => ({
    UserModel: vi.fn().mockImplementation(() => ({
        findByIds: mockFindByIds
    }))
}));

vi.mock('@repo/notifications', () => ({
    createEmailClient: vi.fn().mockReturnValue({}),
    BrevoEmailTransport: vi.fn().mockImplementation(() => ({})),
    EmailAlertChannel: vi.fn().mockImplementation(() => ({ name: 'email' })),
    AlertDigestDeliveryService: vi.fn().mockImplementation(() => ({
        deliver: vi.fn().mockResolvedValue(undefined),
        deliverBatch: mockDeliverBatch
    }))
}));

vi.mock('../../src/utils/env.js', () => ({
    env: mockEnv
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { AlertDigestDeliveryService } from '@repo/notifications';
import { PriceDropEvaluatorService, PromoOfferEvaluatorService } from '@repo/service-core';
import { alertsDigestJob } from '../../src/cron/jobs/alerts-digest.job.js';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

const PRICE_DROP_MATCH = {
    alertId: 'alert-1',
    userId: 'user-1',
    accommodationId: 'acc-1',
    accommodationSlug: 'casa-del-sol',
    accommodationName: 'Casa del Sol',
    basePriceSnapshot: 10000,
    currentPrice: 8000,
    dropPercent: 20,
    currency: 'ARS'
};

describe('Alerts Digest Cron Job', () => {
    let mockLogger: {
        info: Mock;
        warn: Mock;
        error: Mock;
        debug: Mock;
    };
    let mockContext: CronJobContext;

    beforeEach(() => {
        mockLogger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        };

        mockContext = {
            logger: mockLogger,
            startedAt: new Date('2025-01-02T08:00:00Z'),
            dryRun: false
        };

        mockEnv.HOSPEDA_EMAIL_API_KEY = 'test-brevo-key';
        mockEvaluatePriceDrops.mockResolvedValue(new Map());
        mockEvaluatePromoOffers.mockResolvedValue(new Map());
        mockFindByIds.mockResolvedValue([]);
        mockDeliverBatch.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job configuration', () => {
        it('has the correct job name', () => {
            expect(alertsDigestJob.name).toBe('alerts-digest');
        });

        it('runs daily at 8 AM', () => {
            expect(alertsDigestJob.schedule).toBe('0 8 * * *');
        });

        it('is enabled', () => {
            expect(alertsDigestJob.enabled).toBe(true);
        });

        it('has a 5-minute timeout', () => {
            expect(alertsDigestJob.timeoutMs).toBe(300000);
        });
    });

    // -------------------------------------------------------------------------
    // Email not configured
    // -------------------------------------------------------------------------

    describe('Email not configured', () => {
        it('skips dispatch and never calls either evaluator', async () => {
            mockEnv.HOSPEDA_EMAIL_API_KEY = undefined;

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Skipped — email not configured');
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockEvaluatePriceDrops).not.toHaveBeenCalled();
            expect(mockEvaluatePromoOffers).not.toHaveBeenCalled();
            expect(mockFindByIds).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // No qualifying users
    // -------------------------------------------------------------------------

    describe('No qualifying users', () => {
        it('returns success with processed = 0 when both evaluators find nothing', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map());

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockDeliverBatch).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Dry run mode', () => {
        it('reports the would-process count without delivering', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map([['user-1', [PRICE_DROP_MATCH]]]));

            const dryRunContext: CronJobContext = { ...mockContext, dryRun: true };
            const result = await alertsDigestJob.handler(dryRunContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.message).toContain('Dry run');
            expect(result.details?.dryRun).toBe(true);
            expect(result.details?.wouldProcess).toBe(1);
            expect(mockFindByIds).not.toHaveBeenCalled();
            expect(mockDeliverBatch).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Per-user error isolation
    // -------------------------------------------------------------------------

    describe('Per-user error isolation', () => {
        it('skips a missing user but still delivers the digest to the others', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(
                new Map([
                    ['user-1', [PRICE_DROP_MATCH]],
                    [
                        'user-missing',
                        [{ ...PRICE_DROP_MATCH, alertId: 'alert-2', userId: 'user-missing' }]
                    ]
                ])
            );
            // Only user-1 is resolvable — user-missing is absent from the DB result.
            mockFindByIds.mockResolvedValue([
                {
                    id: 'user-1',
                    email: 'user1@example.com',
                    settings: { languageWeb: 'en' }
                }
            ]);

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(result.errors).toBe(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Skipping digest — user not found or missing email',
                { userId: 'user-missing' }
            );
            expect(mockDeliverBatch).toHaveBeenCalledTimes(1);
            const [deliveredBatch] = mockDeliverBatch.mock.calls[0] as [
                Array<{ userId: string; userEmail: string; locale: string }>
            ];
            expect(deliveredBatch).toHaveLength(1);
            expect(deliveredBatch[0]).toMatchObject({
                userId: 'user-1',
                userEmail: 'user1@example.com',
                locale: 'en'
            });
        });

        it('defaults locale to "es" when the user has no languageWeb setting', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map([['user-1', [PRICE_DROP_MATCH]]]));
            mockFindByIds.mockResolvedValue([
                { id: 'user-1', email: 'user1@example.com', settings: undefined }
            ]);

            await alertsDigestJob.handler(mockContext);

            const [deliveredBatch] = mockDeliverBatch.mock.calls[0] as [Array<{ locale: string }>];
            expect(deliveredBatch[0]?.locale).toBe('es');
        });

        it('skips a user found in the DB but with no email', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map([['user-1', [PRICE_DROP_MATCH]]]));
            mockFindByIds.mockResolvedValue([{ id: 'user-1', email: null, settings: undefined }]);

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.processed).toBe(0);
            expect(result.errors).toBe(1);
            expect(mockDeliverBatch).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Successful delivery
    // -------------------------------------------------------------------------

    describe('Successful delivery', () => {
        it('constructs the delivery service with an email channel and delivers the batch', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map([['user-1', [PRICE_DROP_MATCH]]]));
            mockFindByIds.mockResolvedValue([
                { id: 'user-1', email: 'user1@example.com', settings: { languageWeb: 'es' } }
            ]);

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(result.errors).toBe(0);
            expect(AlertDigestDeliveryService).toHaveBeenCalledOnce();
            expect(mockDeliverBatch).toHaveBeenCalledOnce();
        });

        it('chunks users into batches of 50 for deliverBatch', async () => {
            const userIds = Array.from({ length: 120 }, (_, i) => `user-${i}`);
            const priceDropMap = new Map(
                userIds.map((userId) => [
                    userId,
                    [{ ...PRICE_DROP_MATCH, alertId: `alert-${userId}`, userId }]
                ])
            );
            mockEvaluatePriceDrops.mockResolvedValue(priceDropMap);
            mockFindByIds.mockResolvedValue(
                userIds.map((id) => ({ id, email: `${id}@example.com`, settings: undefined }))
            );

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.processed).toBe(120);
            // 120 users / 50 per batch => 3 chunks (50, 50, 20)
            expect(mockDeliverBatch).toHaveBeenCalledTimes(3);
        });

        it('passes both PriceDropEvaluatorService construction and evaluatePriceDrops({ since })', async () => {
            mockEvaluatePriceDrops.mockResolvedValue(new Map());

            await alertsDigestJob.handler(mockContext);

            expect(PriceDropEvaluatorService).toHaveBeenCalledOnce();
            expect(mockEvaluatePriceDrops).toHaveBeenCalledWith({
                since: new Date(mockContext.startedAt.getTime() - 24 * 60 * 60 * 1000)
            });
        });

        it('constructs PromoOfferEvaluatorService and calls evaluatePromoOffers({ since })', async () => {
            mockEvaluatePromoOffers.mockResolvedValue(new Map());

            await alertsDigestJob.handler(mockContext);

            expect(PromoOfferEvaluatorService).toHaveBeenCalledOnce();
            expect(mockEvaluatePromoOffers).toHaveBeenCalledWith({
                since: new Date(mockContext.startedAt.getTime() - 24 * 60 * 60 * 1000)
            });
        });

        it('merges promo-offer matches into the digest payload alongside price drops', async () => {
            const PROMO_OFFER_MATCH = {
                promotionId: 'promo-1',
                accommodationId: 'acc-1',
                accommodationName: 'Casa del Sol',
                accommodationSlug: 'casa-del-sol',
                promotionTitle: 'Summer 20% off',
                discountType: 'percentage',
                discountValue: 20,
                validUntil: null
            };
            mockEvaluatePriceDrops.mockResolvedValue(new Map());
            mockEvaluatePromoOffers.mockResolvedValue(new Map([['user-1', [PROMO_OFFER_MATCH]]]));
            mockFindByIds.mockResolvedValue([
                { id: 'user-1', email: 'user1@example.com', settings: { languageWeb: 'es' } }
            ]);

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(true);
            expect(result.processed).toBe(1);
            expect(mockDeliverBatch).toHaveBeenCalledOnce();
            const [deliveredBatch] = mockDeliverBatch.mock.calls[0] as [
                Array<{ userId: string; priceDrop: unknown[]; promoOffers: unknown[] }>
            ];
            expect(deliveredBatch[0]).toMatchObject({
                userId: 'user-1',
                priceDrop: [],
                promoOffers: [PROMO_OFFER_MATCH]
            });
        });
    });

    // -------------------------------------------------------------------------
    // Unhandled errors
    // -------------------------------------------------------------------------

    describe('Unhandled errors', () => {
        it('returns a failure result when the price-drop evaluator throws', async () => {
            mockEvaluatePriceDrops.mockRejectedValue(new Error('DB connection lost'));

            const result = await alertsDigestJob.handler(mockContext);

            expect(result.success).toBe(false);
            expect(result.message).toContain('DB connection lost');
            expect(result.errors).toBeGreaterThan(0);
            expect(mockLogger.error).toHaveBeenCalledWith(
                'alerts-digest cron failed with unhandled error',
                expect.objectContaining({ error: 'DB connection lost' }),
                { capture: true }
            );
        });
    });
});
