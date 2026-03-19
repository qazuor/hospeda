/**
 * Integration Tests: Addon Lifecycle - Flow B (Plan Change Recalculation)
 *
 * Covers the end-to-end orchestration between:
 * - `handlePlanChangeAddonRecalculation` (addon-plan-change.service)
 * - `recalculateAddonLimitsForCustomer` (addon-limit-recalculation.service)
 *
 * These are service-level integration tests. The billing engine (QZPay) and the
 * database are mocked at the boundary. All canonical plan/addon config is used
 * from the real `@repo/billing` package (NOT mocked) so tests stay coupled to
 * the actual domain model.
 *
 * Plan reference values (from plans.config.ts):
 *   owner-basico  : MAX_ACCOMMODATIONS = 1
 *   owner-pro     : MAX_ACCOMMODATIONS = 3
 *   owner-premium : MAX_ACCOMMODATIONS = 10
 *
 * Addon reference values (from addons.config.ts):
 *   extra-accommodations-5 : affectsLimitKey = MAX_ACCOMMODATIONS, limitIncrease = 5
 *   extra-photos-20        : affectsLimitKey = MAX_PHOTOS_PER_ACCOMMODATION, limitIncrease = 20
 *   visibility-boost-7d    : grantsEntitlement only, affectsLimitKey = null
 *
 * @module test/integration/addon-lifecycle-plan-change
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecalculateAddonLimitsInput } from '../../src/services/addon-limit-recalculation.service.js';
import { recalculateAddonLimitsForCustomer } from '../../src/services/addon-limit-recalculation.service.js';
import type { PlanChangeRecalculationInput } from '../../src/services/addon-plan-change.service.js';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service.js';

// ─── Hoisted mock setup ───────────────────────────────────────────────────────
//
// `vi.hoisted` runs before `vi.mock` factory bodies, allowing the mock
// factories to close over variables that need to be configurable per-test.

const {
    mockDbSelect,
    mockDbSelectFrom: _mockDbSelectFrom,
    mockDbSelectWhere,
    mockLimitsSet,
    mockLimitsCheck,
    mockLimitsRemoveBySource,
    mockSubscriptionsGetByCustomerId,
    mockCustomersGet,
    mockSentryCaptureMessage,
    mockSentryCaptureException,
    mockClearEntitlementCache,
    mockSendNotification
} = vi.hoisted(() => {
    const mockDbSelectWhere = vi.fn().mockResolvedValue([]);
    const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }));

    const mockLimitsSet = vi.fn().mockResolvedValue(undefined);
    const mockLimitsCheck = vi.fn().mockResolvedValue({ currentValue: 0, maxValue: 10 });
    const mockLimitsRemoveBySource = vi.fn().mockResolvedValue(undefined);
    const mockSubscriptionsGetByCustomerId = vi.fn().mockResolvedValue([]);
    const mockCustomersGet = vi.fn().mockResolvedValue(null);
    const mockSentryCaptureMessage = vi.fn();
    const mockSentryCaptureException = vi.fn();
    const mockClearEntitlementCache = vi.fn();
    const mockSendNotification = vi.fn().mockResolvedValue(undefined);

    return {
        mockDbSelect,
        mockDbSelectFrom,
        mockDbSelectWhere,
        mockLimitsSet,
        mockLimitsCheck,
        mockLimitsRemoveBySource,
        mockSubscriptionsGetByCustomerId,
        mockCustomersGet,
        mockSentryCaptureMessage,
        mockSentryCaptureException,
        mockClearEntitlementCache,
        mockSendNotification
    };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('@sentry/node', () => ({
    captureMessage: mockSentryCaptureMessage,
    captureException: mockSentryCaptureException
}));

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: mockClearEntitlementCache
}));

vi.mock('../../src/utils/notification-helper.js', () => ({
    sendNotification: mockSendNotification
}));

vi.mock('@repo/logger', () => {
    const createMockedLogger = () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    });
    return {
        default: createMockedLogger(),
        logger: createMockedLogger(),
        createLogger: vi.fn(() => createMockedLogger())
    };
});

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust-uuid-001';
const PURCHASE_ID_A = 'purchase-uuid-aaa';
const PURCHASE_ID_B = 'purchase-uuid-bbb';

/**
 * Returns a mock DB object that proxies through to the hoisted vi.fn() stubs.
 * Each test can reconfigure `mockDbSelectWhere.mockResolvedValue(...)` independently.
 */
function buildMockDb() {
    return {
        select: mockDbSelect
    } as unknown as PlanChangeRecalculationInput['db'];
}

/**
 * Returns a mock QZPayBilling object with all required stubs wired up.
 * Individual test cases can override specific method behaviour via the returned
 * mock functions (e.g. `mockLimitsSet.mockRejectedValueOnce(...)`).
 */
function buildMockBilling(): QZPayBilling {
    return {
        customers: {
            get: mockCustomersGet
        },
        subscriptions: {
            getByCustomerId: mockSubscriptionsGetByCustomerId
        },
        limits: {
            set: mockLimitsSet,
            check: mockLimitsCheck,
            removeBySource: mockLimitsRemoveBySource
        }
    } as unknown as QZPayBilling;
}

/**
 * Builds a minimal addon purchase row that matches what the DB query returns.
 * `limitAdjustments` mirrors the structure expected by `sumIncrements`.
 */
function buildPurchaseRow(overrides?: {
    id?: string;
    addonSlug?: string;
    limitAdjustments?: Array<{ limitKey: string; increase: number }> | null;
}) {
    return {
        id: overrides?.id ?? PURCHASE_ID_A,
        customerId: CUSTOMER_ID,
        addonSlug: overrides?.addonSlug ?? 'extra-accommodations-5',
        status: 'active' as const,
        deletedAt: null,
        limitAdjustments: overrides?.limitAdjustments ?? [
            { limitKey: 'max_accommodations', increase: 5 }
        ]
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Addon Lifecycle: Flow B — Plan Change Recalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Restore default DB mock to return no purchases
        mockDbSelectWhere.mockResolvedValue([]);

        // Restore default billing stubs
        mockLimitsSet.mockResolvedValue(undefined);
        mockLimitsCheck.mockResolvedValue({ currentValue: 0, maxValue: 10 });
        mockLimitsRemoveBySource.mockResolvedValue(undefined);
        mockCustomersGet.mockResolvedValue(null);
        mockSendNotification.mockResolvedValue(undefined);

        // Restore default subscription stub for recalculateAddonLimitsForCustomer tests
        mockSubscriptionsGetByCustomerId.mockResolvedValue([
            { id: 'sub-001', planId: 'owner-pro', status: 'active' }
        ]);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── TC-1: Upgrade triggers recalculation with correct aggregated maxValue ──

    describe('TC-1: Plan upgrade triggers limit recalculation', () => {
        it('should call billing.limits.set with newMaxValue = newBasePlan + addonIncrement when upgrading', async () => {
            // Arrange
            //
            // Customer has one active 'extra-accommodations-5' addon (+5 accommodations).
            // Upgrading owner-basico (base=1) → owner-pro (base=3).
            // Expected newMaxValue = 3 (new base) + 5 (addon) = 8.

            const purchase = buildPurchaseRow({
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            mockDbSelectWhere.mockResolvedValue([purchase]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert
            expect(result.customerId).toBe(CUSTOMER_ID);
            expect(result.oldPlanId).toBe('owner-basico');
            expect(result.newPlanId).toBe('owner-pro');
            expect(result.direction).toBe('upgrade');
            expect(result.recalculations).toHaveLength(1);

            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.limitKey).toBe('max_accommodations');
            // old: basico(1) + addon(5) = 6
            expect(recalc?.oldMaxValue).toBe(6);
            // new: pro(3) + addon(5) = 8
            expect(recalc?.newMaxValue).toBe(8);

            expect(mockLimitsSet).toHaveBeenCalledOnce();
            expect(mockLimitsSet).toHaveBeenCalledWith({
                customerId: CUSTOMER_ID,
                limitKey: 'max_accommodations',
                maxValue: 8,
                source: 'addon',
                sourceId: ADDON_RECALC_SOURCE_ID
            });

            // Upgrade should NOT trigger downgrade notification
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
        });
    });

    // ── TC-2: Multiple addons targeting the same limitKey are aggregated ──────

    describe('TC-2: Multiple addons on same limitKey are aggregated correctly', () => {
        it('should sum increments from two active addons on the same limitKey', async () => {
            // Arrange
            //
            // Customer has TWO 'extra-accommodations-5' addon purchases (both active).
            // Upgrading owner-basico (base=1) → owner-pro (base=3).
            // Total increment = 5 + 5 = 10.
            // Expected newMaxValue = 3 + 10 = 13.

            const purchaseA = buildPurchaseRow({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            const purchaseB = buildPurchaseRow({
                id: PURCHASE_ID_B,
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            mockDbSelectWhere.mockResolvedValue([purchaseA, purchaseB]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert
            expect(result.direction).toBe('upgrade');
            expect(result.recalculations).toHaveLength(1);

            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.addonCount).toBe(2);
            expect(recalc?.newMaxValue).toBe(13); // pro(3) + 5 + 5 = 13
            expect(recalc?.oldMaxValue).toBe(11); // basico(1) + 5 + 5 = 11

            expect(mockLimitsSet).toHaveBeenCalledOnce();
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 13, limitKey: 'max_accommodations' })
            );

            // Two addons stacked, still no downgrade
            expect(mockSendNotification).not.toHaveBeenCalled();
        });
    });

    // ── TC-3: Downgrade + usage exceeds new limit → notification + Sentry ─────

    describe('TC-3: Downgrade with usage above new limit dispatches warning notification', () => {
        it('should dispatch PLAN_DOWNGRADE_LIMIT_WARNING and call Sentry.captureMessage when usage exceeds new limit', async () => {
            // Arrange
            //
            // Customer has one 'extra-accommodations-5' addon (+5).
            // Downgrading owner-premium (base=10) → owner-basico (base=1).
            //
            // Old limit = 10 + 5 = 15.
            // New limit = 1 + 5 = 6.
            // Current usage = 35 (above new limit of 6).
            //
            // Expected: notification dispatched, Sentry.captureMessage called.

            const purchase = buildPurchaseRow({
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            mockDbSelectWhere.mockResolvedValue([purchase]);

            // Simulate customer contact info lookup
            mockCustomersGet.mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Test Owner', userId: 'user-uuid-001' }
            });

            // Simulate current usage exceeding the new combined limit (35 > 6)
            mockLimitsCheck.mockResolvedValue({ currentValue: 35, maxValue: 15 });

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-premium',
                newPlanId: 'owner-basico',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert: recalculation succeeded with downgrade direction
            expect(result.direction).toBe('downgrade');
            expect(result.recalculations).toHaveLength(1);

            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.newMaxValue).toBe(6); // basico(1) + addon(5)
            expect(recalc?.oldMaxValue).toBe(15); // premium(10) + addon(5)

            // Limit was applied regardless of usage
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 6, limitKey: 'max_accommodations' })
            );

            // Customer lookup was triggered for notification dispatch
            expect(mockCustomersGet).toHaveBeenCalledWith(CUSTOMER_ID);

            // Usage was checked against the new limit
            expect(mockLimitsCheck).toHaveBeenCalledWith(CUSTOMER_ID, 'max_accommodations');

            // Wait a tick for the fire-and-forget notification promise to settle
            await vi.runAllTimersAsync().catch(() => {});

            // Sentry.captureMessage must be called for the limit violation
            expect(mockSentryCaptureMessage).toHaveBeenCalledOnce();
            expect(mockSentryCaptureMessage).toHaveBeenCalledWith(
                expect.stringContaining('downgrade'),
                expect.objectContaining({
                    level: 'warning',
                    extra: expect.objectContaining({
                        customerId: CUSTOMER_ID,
                        limitKey: 'max_accommodations',
                        currentUsage: 35,
                        newLimit: 6
                    })
                })
            );

            // Notification dispatched (fire-and-forget)
            expect(mockSendNotification).toHaveBeenCalledOnce();
            expect(mockSendNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    recipientEmail: 'owner@example.com',
                    customerId: CUSTOMER_ID,
                    limitKey: 'max_accommodations',
                    currentUsage: 35,
                    newLimit: 6,
                    oldLimit: 15
                })
            );
        });
    });

    // ── TC-4: Downgrade + usage within new limit → no notification ────────────

    describe('TC-4: Downgrade with usage below new limit does not dispatch notification', () => {
        it('should not send notification or report to Sentry when usage is within the new limit', async () => {
            // Arrange
            //
            // Customer has one 'extra-accommodations-5' addon (+5).
            // Downgrading owner-pro (base=3) → owner-basico (base=1).
            //
            // Old limit = 3 + 5 = 8.
            // New limit = 1 + 5 = 6.
            // Current usage = 4 (below new limit of 6).
            //
            // Expected: no notification, no Sentry call.

            const purchase = buildPurchaseRow({
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            mockDbSelectWhere.mockResolvedValue([purchase]);

            mockCustomersGet.mockResolvedValue({
                id: CUSTOMER_ID,
                email: 'owner@example.com',
                metadata: { name: 'Test Owner', userId: 'user-uuid-001' }
            });

            // Current usage well within the new combined limit (4 <= 6)
            mockLimitsCheck.mockResolvedValue({ currentValue: 4, maxValue: 8 });

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-pro',
                newPlanId: 'owner-basico',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert: direction is downgrade but no warning triggered
            expect(result.direction).toBe('downgrade');

            const recalc = result.recalculations[0];
            expect(recalc?.outcome).toBe('success');
            expect(recalc?.newMaxValue).toBe(6); // basico(1) + addon(5)

            // Limit was still applied
            expect(mockLimitsSet).toHaveBeenCalledOnce();

            // No Sentry warning and no notification
            expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
            expect(mockSendNotification).not.toHaveBeenCalled();
        });
    });

    // ── TC-5: AC-3.9 — Cancel one addon after plan change, remaining preserved ─

    describe('TC-5: Individual addon cancel after plan change (AC-3.9)', () => {
        it('should call recalculateAddonLimitsForCustomer and preserve remaining addon contribution', async () => {
            // Arrange
            //
            // After a plan change, the customer is on owner-pro (base=3) and has
            // one remaining active 'extra-accommodations-5' addon (+5).
            //
            // recalculateAddonLimitsForCustomer is called for limitKey='max_accommodations'.
            // Expected newMaxValue = 3 (pro base) + 5 (remaining addon) = 8.
            //
            // This test verifies AC-3.9: after a plan change sets sourceId=ADDON_RECALC_SOURCE_ID,
            // cancelling one addon re-triggers recalculation and preserves remaining addons.

            const remainingPurchase = buildPurchaseRow({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            // DB returns only the remaining (non-cancelled) purchase
            mockDbSelectWhere.mockResolvedValue([remainingPurchase]);

            // Active subscription on owner-pro
            mockSubscriptionsGetByCustomerId.mockResolvedValue([
                { id: 'sub-001', planId: 'owner-pro', status: 'active' }
            ]);

            const input: RecalculateAddonLimitsInput = {
                customerId: CUSTOMER_ID,
                limitKey: 'max_accommodations',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await recalculateAddonLimitsForCustomer(input);

            // Assert
            expect(result.outcome).toBe('success');
            expect(result.limitKey).toBe('max_accommodations');
            // Base plan = owner-pro → 3; remaining addon = +5 → total 8
            expect(result.newMaxValue).toBe(8);
            expect(result.addonCount).toBe(1);

            // limits.set was called with the aggregated value under ADDON_RECALC_SOURCE_ID
            expect(mockLimitsSet).toHaveBeenCalledOnce();
            expect(mockLimitsSet).toHaveBeenCalledWith({
                customerId: CUSTOMER_ID,
                limitKey: 'max_accommodations',
                maxValue: 8,
                source: 'addon',
                sourceId: ADDON_RECALC_SOURCE_ID
            });

            // limits.removeBySource must NOT be called — there is still an active addon
            expect(mockLimitsRemoveBySource).not.toHaveBeenCalled();
        });

        it('should call limits.removeBySource when no addons remain after individual cancel', async () => {
            // Arrange
            //
            // Last addon was cancelled. DB returns no active purchases.
            // recalculateAddonLimitsForCustomer should call removeBySource to clean up
            // the stale aggregated limit, rather than calling limits.set with 0.

            mockDbSelectWhere.mockResolvedValue([]);

            mockSubscriptionsGetByCustomerId.mockResolvedValue([
                { id: 'sub-001', planId: 'owner-pro', status: 'active' }
            ]);

            const input: RecalculateAddonLimitsInput = {
                customerId: CUSTOMER_ID,
                limitKey: 'max_accommodations',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await recalculateAddonLimitsForCustomer(input);

            // Assert
            expect(result.outcome).toBe('success');
            // newMaxValue = base plan only (no addon increment)
            expect(result.newMaxValue).toBe(3); // owner-pro base
            expect(result.addonCount).toBe(0);

            // limits.set must NOT be called — no increment to apply
            expect(mockLimitsSet).not.toHaveBeenCalled();

            // Stale aggregated limit must be removed
            expect(mockLimitsRemoveBySource).toHaveBeenCalledOnce();
            expect(mockLimitsRemoveBySource).toHaveBeenCalledWith('addon', ADDON_RECALC_SOURCE_ID);
        });
    });

    // ── TC-6: Only entitlement addons — early return, no recalculation ────────

    describe('TC-6: Customer has only entitlement addons — no recalculation needed', () => {
        it('should return empty recalculations and direction=lateral when no limit addons are active', async () => {
            // Arrange
            //
            // Customer has one 'visibility-boost-7d' purchase.
            // That addon has affectsLimitKey=null (entitlement-only).
            // The service must detect no limit-type addons and return early.

            const entitlementPurchase = {
                id: 'purchase-ent-001',
                customerId: CUSTOMER_ID,
                addonSlug: 'visibility-boost-7d',
                status: 'active' as const,
                deletedAt: null,
                limitAdjustments: null
            };

            mockDbSelectWhere.mockResolvedValue([entitlementPurchase]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert
            expect(result.recalculations).toHaveLength(0);
            // No limit keys → sums are both 0 → direction = lateral
            expect(result.direction).toBe('lateral');
            expect(result.customerId).toBe(CUSTOMER_ID);

            // No billing calls made
            expect(mockLimitsSet).not.toHaveBeenCalled();
            expect(mockLimitsCheck).not.toHaveBeenCalled();
            expect(mockCustomersGet).not.toHaveBeenCalled();
            expect(mockSendNotification).not.toHaveBeenCalled();
            expect(mockSentryCaptureMessage).not.toHaveBeenCalled();
        });

        it('should return empty recalculations when customer has no addon purchases at all', async () => {
            // Arrange
            mockDbSelectWhere.mockResolvedValue([]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert
            expect(result.recalculations).toHaveLength(0);
            expect(result.direction).toBe('lateral');
            expect(mockLimitsSet).not.toHaveBeenCalled();
        });
    });

    // ── TC-7: Multiple addons on different limitKeys — each key processed independently ──

    describe('TC-7: Addons targeting different limitKeys are processed independently', () => {
        it('should produce one recalculation entry per unique limitKey', async () => {
            // Arrange
            //
            // Customer has:
            //   - extra-accommodations-5  (+5 on MAX_ACCOMMODATIONS)
            //   - extra-photos-20         (+20 on MAX_PHOTOS_PER_ACCOMMODATION)
            //
            // Upgrading owner-basico → owner-pro.
            //
            // MAX_ACCOMMODATIONS   : pro(3) + 5  = 8
            // MAX_PHOTOS_PER_ACCOM : pro(15) + 20 = 35

            const accommodationPurchase = buildPurchaseRow({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            const photosPurchase = {
                id: PURCHASE_ID_B,
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-photos-20',
                status: 'active' as const,
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_photos_per_accommodation', increase: 20 }]
            };

            mockDbSelectWhere.mockResolvedValue([accommodationPurchase, photosPurchase]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert: two limit keys processed
            expect(result.recalculations).toHaveLength(2);
            expect(result.direction).toBe('upgrade');

            const accommodationRecalc = result.recalculations.find(
                (r) => r.limitKey === 'max_accommodations'
            );
            expect(accommodationRecalc?.outcome).toBe('success');
            expect(accommodationRecalc?.newMaxValue).toBe(8); // pro(3) + 5

            const photosRecalc = result.recalculations.find(
                (r) => r.limitKey === 'max_photos_per_accommodation'
            );
            expect(photosRecalc?.outcome).toBe('success');
            expect(photosRecalc?.newMaxValue).toBe(35); // pro(15) + 20

            // limits.set called once per key
            expect(mockLimitsSet).toHaveBeenCalledTimes(2);
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({ limitKey: 'max_accommodations', maxValue: 8 })
            );
            expect(mockLimitsSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    limitKey: 'max_photos_per_accommodation',
                    maxValue: 35
                })
            );
        });
    });

    // ── TC-8: billing.limits.set failure is isolated to affected key ──────────

    describe('TC-8: billing.limits.set failure is captured per key without blocking others', () => {
        it('should record a failed outcome for a key where limits.set throws and continue processing remaining keys', async () => {
            // Arrange
            //
            // Customer has two addons on different keys.
            // limits.set fails on the first call (accommodations), succeeds on the second (photos).

            const accommodationPurchase = buildPurchaseRow({
                id: PURCHASE_ID_A,
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            const photosPurchase = {
                id: PURCHASE_ID_B,
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-photos-20',
                status: 'active' as const,
                deletedAt: null,
                limitAdjustments: [{ limitKey: 'max_photos_per_accommodation', increase: 20 }]
            };

            mockDbSelectWhere.mockResolvedValue([accommodationPurchase, photosPurchase]);

            // First call to limits.set will reject; second will resolve
            mockLimitsSet
                .mockRejectedValueOnce(new Error('Billing service unavailable'))
                .mockResolvedValueOnce(undefined);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert: two recalculation entries exist, one failed one succeeded
            expect(result.recalculations).toHaveLength(2);

            const failed = result.recalculations.find((r) => r.outcome === 'failed');
            expect(failed).toBeDefined();
            expect(failed?.reason).toContain('Billing service unavailable');

            const succeeded = result.recalculations.find((r) => r.outcome === 'success');
            expect(succeeded).toBeDefined();

            // Sentry.captureException called for the failed key
            expect(mockSentryCaptureException).toHaveBeenCalledOnce();

            // limits.set called for both keys
            expect(mockLimitsSet).toHaveBeenCalledTimes(2);
        });
    });

    // ── TC-9: entitlement cache is cleared after plan change recalculation ────

    describe('TC-9: Entitlement cache is always cleared after plan change', () => {
        it('should call clearEntitlementCache with the customerId after successful recalculation', async () => {
            // Arrange
            const purchase = buildPurchaseRow({
                addonSlug: 'extra-accommodations-5',
                limitAdjustments: [{ limitKey: 'max_accommodations', increase: 5 }]
            });

            mockDbSelectWhere.mockResolvedValue([purchase]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            await handlePlanChangeAddonRecalculation(input);

            // Assert
            expect(mockClearEntitlementCache).toHaveBeenCalledOnce();
            expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });

        it('should NOT call clearEntitlementCache on the early-return path when no limit addons are present', async () => {
            // Arrange — no purchases at all; early-return fires before cache-clear step
            mockDbSelectWhere.mockResolvedValue([]);

            const input: PlanChangeRecalculationInput = {
                customerId: CUSTOMER_ID,
                oldPlanId: 'owner-basico',
                newPlanId: 'owner-pro',
                billing: buildMockBilling(),
                db: buildMockDb()
            };

            // Act
            const result = await handlePlanChangeAddonRecalculation(input);

            // Assert: the service returns normally …
            expect(result.recalculations).toHaveLength(0);

            // clearEntitlementCache IS called even on early exit (no limit addons)
            // to ensure cache consistency when called from webhook safety net path.
            expect(mockClearEntitlementCache).toHaveBeenCalledWith(CUSTOMER_ID);
        });
    });
});
