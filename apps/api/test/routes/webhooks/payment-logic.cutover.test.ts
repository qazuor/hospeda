/**
 * Parity tests for payment-logic.ts addon reads cutover (SPEC-192 T-016)
 *
 * Verifies that `processPaymentUpdated` now resolves the addon definition for
 * the purchase notification via the DB-backed `AddonCatalogService.getBySlug()`
 * instead of the static `getAddonBySlug` from `@repo/billing`.
 *
 * Call site: the notification-dispatch path inside `processPaymentUpdated` after
 * a successful `addonService.confirmPurchase`. Previously used `getAddonBySlug(addonSlug)`
 * synchronously; now awaits `catalogService.getBySlug(addonSlug)`.
 *
 * Semantics preserved:
 * - Success → `addon.name` used as `planName` in the purchase notification
 * - NOT_FOUND → `addon = undefined` → notification NOT sent (identical to old undefined branch)
 * - `getAddonBySlug` from `@repo/billing` is NEVER called after cutover
 *
 * These tests do NOT modify the existing `payment-logic.test.ts` suite. They are
 * additive cutover parity tests that run alongside the existing unit tests.
 *
 * No real database. All DB and billing calls are mocked.
 *
 * @module test/routes/webhooks/payment-logic.cutover.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetBySlug, mockGetAddonBySlug } = vi.hoisted(() => ({
    mockGetBySlug: vi.fn(),
    mockGetAddonBySlug: vi.fn()
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(() => ({
        getBySlug: mockGetBySlug,
        list: vi.fn()
    }))
}));

// getAddonBySlug must NOT be called after cutover
vi.mock('@repo/billing', () => ({
    getAddonBySlug: mockGetAddonBySlug
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue([])
                })
            })
        })
    }),
    and: vi.fn((...args: unknown[]) => ({ _and: args })),
    eq: vi.fn((a: unknown, b: unknown) => ({ _eq: [a, b] })),
    isNull: vi.fn((a: unknown) => ({ _isNull: a })),
    sql: vi.fn(
        Object.assign((s: TemplateStringsArray, ...v: unknown[]) => ({ _sql: { s, v } }), {
            empty: { _sql: 'empty' }
        })
    ),
    billingPayments: { id: 'id', providerPaymentIds: 'ppids' },
    billingSubscriptions: { id: 'id', customerId: 'cid', status: 'status', deletedAt: 'dat' }
}));

vi.mock('../../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/routes/webhooks/mercadopago/notifications', () => ({
    sendPaymentSuccessNotification: vi.fn().mockResolvedValue(undefined),
    sendPaymentFailureNotifications: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/routes/webhooks/mercadopago/utils', () => ({
    extractPaymentInfo: vi.fn().mockReturnValue(null),
    extractAddonMetadata: vi.fn().mockReturnValue({
        addonSlug: 'visibility-boost-7d',
        customerId: 'cust-uuid'
    }),
    extractAddonFromReference: vi.fn().mockReturnValue(null),
    extractAnnualSubscriptionMetadata: vi.fn().mockReturnValue(null),
    extractPlanChangeUpgradeMetadata: vi.fn().mockReturnValue(null)
}));

vi.mock('../../../src/services/addon.service', () => ({
    AddonService: vi.fn().mockImplementation(() => ({
        confirmPurchase: vi.fn().mockResolvedValue({ success: true, data: undefined })
    }))
}));

vi.mock('../../../src/services/addon-plan-change.service', () => ({
    handlePlanChangeAddonRecalculation: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/services/subscription-downgrade.service', () => ({
    clearPendingScheduledPlanChange: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@repo/schemas', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        SubscriptionStatusEnum: {
            ACTIVE: 'active',
            PENDING_PROVIDER: 'pending_provider',
            CANCELLED: 'cancelled'
        }
    };
});

vi.mock('@repo/notifications', () => ({
    NotificationType: {
        ADDON_PURCHASE: 'ADDON_PURCHASE'
    }
}));

// Import after mocks
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { processPaymentUpdated } from '../../../src/routes/webhooks/mercadopago/payment-logic';
import { extractAddonMetadata } from '../../../src/routes/webhooks/mercadopago/utils';
import { sendNotification } from '../../../src/utils/notification-helper';

// ─── Catalog stubs ────────────────────────────────────────────────────────────

const STUB_VISIBILITY_7D = {
    slug: 'visibility-boost-7d',
    name: 'Visibility Boost (7 days)',
    description: 'Featured in search results for 7 days.',
    billingType: 'one_time' as const,
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner', 'complex'] as Array<'owner' | 'complex'>,
    isActive: true,
    sortOrder: 1
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBilling(): QZPayBilling {
    return {
        customers: {
            get: vi.fn().mockResolvedValue({
                id: 'cust-uuid',
                email: 'user@test.com',
                metadata: { name: 'Test User', userId: 'usr-1' }
            })
        }
    } as unknown as QZPayBilling;
}

/** Minimal event payload with addonSlug metadata (the path we care about). */
function buildAddonPaymentEvent(addonSlug: string, paymentId = 'mp-123') {
    return {
        id: paymentId,
        transaction_amount: 5000,
        currency_id: 'ARS',
        metadata: {
            addonSlug,
            customerId: 'cust-uuid'
        }
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('payment-logic.ts addon reads cutover parity (SPEC-192 T-016)', () => {
    let billing: QZPayBilling;

    beforeEach(() => {
        // clearAllMocks: resets call counts across all spies (sendNotification, etc.)
        // then re-apply implementations that clearAllMocks wiped.
        vi.clearAllMocks();
        billing = buildBilling();
        mockGetBySlug.mockReset();
        mockGetAddonBySlug.mockReset();
        // Default: extractAddonMetadata returns the addon slug
        vi.mocked(extractAddonMetadata).mockReturnValue({
            addonSlug: 'visibility-boost-7d',
            customerId: 'cust-uuid'
        });
    });

    describe('addon definition now resolved via AddonCatalogService.getBySlug', () => {
        it('should call catalogService.getBySlug (not getAddonBySlug) for the addon slug', async () => {
            // Arrange — catalog returns the addon definition
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });
            const data = buildAddonPaymentEvent('visibility-boost-7d');

            // Act
            await processPaymentUpdated({ data, billing, source: 'webhook' });

            // Assert
            expect(mockGetBySlug).toHaveBeenCalledWith('visibility-boost-7d');
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should send purchase notification with addon.name from DB catalog', async () => {
            // Arrange
            mockGetBySlug.mockResolvedValue({ success: true, data: STUB_VISIBILITY_7D });
            const data = buildAddonPaymentEvent('visibility-boost-7d');

            // Act
            await processPaymentUpdated({ data, billing, source: 'webhook' });

            // Assert — notification sent with catalog-resolved name
            expect(sendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    planName: 'Visibility Boost (7 days)' // from STUB_VISIBILITY_7D.name
                })
            );
        });

        it('should NOT send notification when catalog returns NOT_FOUND (preserves old !addon branch)', async () => {
            // Arrange — catalog returns NOT_FOUND → addon=undefined → notification not sent
            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'visibility-boost-7d' not found" }
            });
            const data = buildAddonPaymentEvent('visibility-boost-7d', 'mp-not-found');

            // Act
            await processPaymentUpdated({ data, billing, source: 'webhook' });

            // Assert — notification NOT sent (identical to old behavior when getAddonBySlug returned undefined)
            expect(sendNotification).not.toHaveBeenCalled();
            expect(mockGetAddonBySlug).not.toHaveBeenCalled();
        });

        it('should still confirm the purchase even when catalog returns NOT_FOUND', async () => {
            // Arrange — catalog NOT_FOUND only affects notification, not purchase confirmation
            const { AddonService } = await import('../../../src/services/addon.service');
            const mockConfirmPurchase = vi.fn().mockResolvedValue({ success: true });
            vi.mocked(AddonService).mockImplementation(
                () => ({ confirmPurchase: mockConfirmPurchase }) as never
            );

            mockGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: "Add-on 'unknown-slug' not found" }
            });
            vi.mocked(extractAddonMetadata).mockReturnValue({
                addonSlug: 'unknown-slug',
                customerId: 'cust-uuid'
            });
            const data = buildAddonPaymentEvent('unknown-slug', 'mp-confirm-test');

            // Act
            const result = await processPaymentUpdated({ data, billing, source: 'webhook' });

            // Assert — purchase was confirmed despite missing catalog entry
            expect(mockConfirmPurchase).toHaveBeenCalledWith({
                customerId: 'cust-uuid',
                addonSlug: 'unknown-slug'
            });
            expect(result.addonConfirmed).toBe(true);
            // But notification was NOT sent (addon name unavailable)
            expect(sendNotification).not.toHaveBeenCalled();
        });
    });
});
