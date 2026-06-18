/**
 * Refresh External Reputation Cron Job Tests (SPEC-237 T-011)
 *
 * Mocks the helper functions exported from the job module
 * (`getEnabledAccommodationIds`, `getGoogleSnippetTimestamps`) and
 * `AccommodationExternalReputationService.refresh` to verify:
 *
 * - All enabled listings' accommodation IDs are refreshed.
 * - Google TTL-priority ordering puts null/expiring-soon entries first.
 * - A per-accommodation error is logged and the batch continues (never throws).
 * - Dry-run mode returns the count without calling the service.
 * - An empty set of enabled listings produces a success result with processed=0.
 *
 * @module test/cron/refresh-external-reputation
 */

import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — must come before vi.mock() calls
// ---------------------------------------------------------------------------

const { mockGetEnabledIds, mockGetGoogleTs, mockRefresh } = vi.hoisted(() => ({
    mockGetEnabledIds: vi.fn().mockResolvedValue([] as string[]),
    mockGetGoogleTs: vi.fn().mockResolvedValue(new Map<string, Date | null>()),
    mockRefresh: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Mock the DB query helpers from the dedicated queries module.
// The job module imports these functions from this module, so mocking here
// ensures the job handler uses the mocks during tests.
vi.mock('../../src/cron/jobs/refresh-external-reputation.queries.js', () => ({
    getEnabledAccommodationIds: mockGetEnabledIds,
    getGoogleSnippetTimestamps: mockGetGoogleTs
}));

// The job reads HOSPEDA_EXTREP_GOOGLE_SNIPPET_TTL_DAYS from process.env directly.
// Vitest uses the real process.env; the default (30) is used when not set.
// No need to mock the env module for this job.

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationExternalListingModel: vi.fn(),
        AccommodationExternalReputationModel: vi.fn(),
        AccommodationModel: vi.fn()
    };
});

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/schemas')>();
    return { ...actual };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationExternalReputationService: vi.fn().mockImplementation(() => ({
            refresh: mockRefresh
        }))
    };
});

// ---------------------------------------------------------------------------
// Import under test — AFTER mocks are declared
// ---------------------------------------------------------------------------

import { refreshExternalReputationJob } from '../../src/cron/jobs/refresh-external-reputation.job.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ACC_1 = '11111111-1111-4111-8111-111111111111';
const ACC_2 = '22222222-2222-4222-8222-222222222222';
const ACC_3 = '33333333-3333-4333-8333-333333333333';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date('2026-06-16T02:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Refresh External Reputation Cron Job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetEnabledIds.mockResolvedValue([]);
        mockGetGoogleTs.mockResolvedValue(new Map());
        mockRefresh.mockResolvedValue({ data: { succeeded: ['GOOGLE'], failed: [] } });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // -------------------------------------------------------------------------
    // Job configuration
    // -------------------------------------------------------------------------

    describe('Job configuration', () => {
        it('has the expected configuration', () => {
            expect(refreshExternalReputationJob.name).toBe('refresh-external-reputation');
            expect(refreshExternalReputationJob.schedule).toBe('0 2 * * 1');
            expect(refreshExternalReputationJob.enabled).toBe(true);
            expect(typeof refreshExternalReputationJob.handler).toBe('function');
        });
    });

    // -------------------------------------------------------------------------
    // Dry run
    // -------------------------------------------------------------------------

    describe('Handler — dry run', () => {
        it('returns count without calling service refresh in dry-run mode', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1, ACC_2]);

            const result = await refreshExternalReputationJob.handler(makeCtx({ dryRun: true }));

            expect(result.success).toBe(true);
            expect(result.processed).toBe(2);
            expect(result.message).toContain('Dry run');
            expect(result.details?.dryRun).toBe(true);
            expect(mockRefresh).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Empty set
    // -------------------------------------------------------------------------

    describe('Handler — empty set', () => {
        it('returns success with processed=0 when no enabled listings exist', async () => {
            mockGetEnabledIds.mockResolvedValue([]);

            const result = await refreshExternalReputationJob.handler(makeCtx());

            expect(result.success).toBe(true);
            expect(result.processed).toBe(0);
            expect(result.errors).toBe(0);
            expect(mockRefresh).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // All accommodations refreshed
    // -------------------------------------------------------------------------

    describe('Handler — all accommodations refreshed', () => {
        it('calls refresh for every enabled accommodation', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1, ACC_2, ACC_3]);

            const result = await refreshExternalReputationJob.handler(makeCtx());

            expect(mockRefresh).toHaveBeenCalledTimes(3);
            expect(result.success).toBe(true);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(0);
        });

        it('passes bypassRateLimit: true to service refresh', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1]);

            await refreshExternalReputationJob.handler(makeCtx());

            expect(mockRefresh).toHaveBeenCalledWith(
                ACC_1,
                expect.objectContaining({ id: '00000000-0000-0000-0000-000000000002' }),
                undefined,
                { bypassRateLimit: true }
            );
        });
    });

    // -------------------------------------------------------------------------
    // Google TTL priority ordering
    // -------------------------------------------------------------------------

    describe('Handler — Google TTL priority ordering', () => {
        it('puts null-snippet accommodations before those with fresh snippets', async () => {
            const now = new Date('2026-06-16T02:00:00Z');
            vi.useFakeTimers();
            vi.setSystemTime(now);

            // ACC_1: fresh snippet (3 days old — not urgent, TTL=30, threshold=25d)
            const freshTs = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
            // ACC_2: null (never fetched — highest priority)
            // ACC_3: expiring soon (26 days old — past threshold of 25 days)
            const expiringTs = new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000);

            mockGetEnabledIds.mockResolvedValue([ACC_1, ACC_2, ACC_3]);
            mockGetGoogleTs.mockResolvedValue(
                new Map([
                    [ACC_1, freshTs],
                    [ACC_2, null],
                    [ACC_3, expiringTs]
                ])
            );

            const callOrder: string[] = [];
            mockRefresh.mockImplementation(async (accId: string) => {
                callOrder.push(accId);
                return { data: { succeeded: ['GOOGLE'], failed: [] } };
            });

            await refreshExternalReputationJob.handler(makeCtx());

            // ACC_2 (null) → ACC_3 (expiring) → ACC_1 (fresh)
            expect(callOrder[0]).toBe(ACC_2);
            expect(callOrder[1]).toBe(ACC_3);
            expect(callOrder[2]).toBe(ACC_1);
        });
    });

    // -------------------------------------------------------------------------
    // Partial errors — batch never aborts
    // -------------------------------------------------------------------------

    describe('Handler — partial errors do not abort the batch', () => {
        it('continues processing remaining accommodations after a per-accommodation error', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1, ACC_2, ACC_3]);

            mockRefresh
                .mockResolvedValueOnce({ data: { succeeded: ['GOOGLE'], failed: [] } })
                .mockRejectedValueOnce(new Error('timeout'))
                .mockResolvedValueOnce({ data: { succeeded: ['BOOKING'], failed: [] } });

            const ctx = makeCtx();
            const result = await refreshExternalReputationJob.handler(ctx);

            expect(mockRefresh).toHaveBeenCalledTimes(3);
            expect(result.processed).toBe(3);
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
            expect(ctx.logger.error as Mock).toHaveBeenCalled();
        });

        it('counts service-level failures (failed array) as errors', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1]);

            mockRefresh.mockResolvedValue({
                data: {
                    succeeded: [],
                    failed: [
                        { platform: 'GOOGLE', error: 'API quota exceeded' },
                        { platform: 'BOOKING', error: 'timeout' }
                    ]
                }
            });

            const result = await refreshExternalReputationJob.handler(makeCtx());

            expect(result.processed).toBe(1);
            expect(result.errors).toBe(2);
            expect(result.success).toBe(false);
        });

        it('counts service output error (QUOTA_EXCEEDED) as an error and continues', async () => {
            mockGetEnabledIds.mockResolvedValue([ACC_1, ACC_2]);

            mockRefresh
                .mockResolvedValueOnce({
                    error: { code: 'QUOTA_EXCEEDED', message: 'Rate limited' }
                })
                .mockResolvedValueOnce({ data: { succeeded: ['GOOGLE'], failed: [] } });

            const result = await refreshExternalReputationJob.handler(makeCtx());

            expect(result.processed).toBe(2);
            expect(result.errors).toBe(1);
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // DB fetch failure
    // -------------------------------------------------------------------------

    describe('Handler — DB fetch failure', () => {
        it('returns success=false when getEnabledAccommodationIds fails', async () => {
            mockGetEnabledIds.mockRejectedValue(new Error('DB connection lost'));

            const ctx = makeCtx();
            const result = await refreshExternalReputationJob.handler(ctx);

            expect(result.success).toBe(false);
            expect(result.errors).toBe(1);
            expect(result.processed).toBe(0);
            expect(ctx.logger.error as Mock).toHaveBeenCalled();
            expect(mockRefresh).not.toHaveBeenCalled();
        });
    });
});
