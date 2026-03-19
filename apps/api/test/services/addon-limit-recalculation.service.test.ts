/**
 * Tests for recalculateAddonLimitsForCustomer() — T-019
 *
 * Covers:
 * - T-019-1: Single addon — basePlanLimit + addonIncrement applied via limits.set
 * - T-019-2: Multiple addons same limitKey — increments are SUM'd
 * - T-019-3: No remaining addons — removeBySource called to clean stale aggregated limit
 * - T-019-4: Unlimited base plan (-1) — recalculation skipped, outcome='skipped'
 * - T-019-5: Plan not found in config — outcome='failed'
 * - T-019-6: limitKey not present in plan limits — basePlanLimit treated as 0, warning logged
 * - T-019-7: No active subscription — outcome='failed'
 * - T-019-8: Purchase with no matching limitAdjustment — increment contribution is 0
 *
 * @module test/services/addon-limit-recalculation.service.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { ADDON_RECALC_SOURCE_ID } from '@repo/service-core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recalculateAddonLimitsForCustomer } from '../../src/services/addon-limit-recalculation.service';
import { createMockBilling } from '../helpers/mock-factories';

// ─── Hoisted mock factories ───────────────────────────────────────────────────
//
// Must be hoisted so they are available when vi.mock factory functions run.

const {
    mockDbWhere,
    mockDbFrom: _mockDbFrom,
    mockDbSelect,
    mockBillingAddonPurchasesSchema
} = vi.hoisted(() => {
    const mockDbWhere = vi.fn().mockResolvedValue([]);
    const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

    const mockBillingAddonPurchasesSchema = {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    };

    return {
        mockDbWhere,
        mockDbFrom,
        mockDbSelect,
        mockBillingAddonPurchasesSchema
    };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesSchema
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getPlanBySlug: vi.fn(),
        getAddonBySlug: vi.fn()
    };
});

// drizzle helpers (eq, and, isNull) pass through unchanged
vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual };
});

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust_recalc_test_001';
const LIMIT_KEY = 'max_accommodations';
const PLAN_SLUG = 'owner-pro';

/**
 * Plan with base limit of 10 for LIMIT_KEY.
 */
const mockPlanWithLimit = {
    slug: PLAN_SLUG,
    name: 'Owner Pro',
    description: 'Pro plan',
    category: 'owner',
    monthlyPriceArs: 5000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 2,
    entitlements: [],
    limits: [{ key: LIMIT_KEY, value: 10, name: 'Max accommodations', description: 'Max' }],
    isActive: true
};

/**
 * Plan where the limitKey has value -1 (unlimited).
 */
const mockPlanUnlimited = {
    ...mockPlanWithLimit,
    limits: [{ key: LIMIT_KEY, value: -1, name: 'Max accommodations', description: 'Unlimited' }]
};

/**
 * Plan that does NOT have the limitKey in its limits array.
 */
const mockPlanWithoutLimitKey = {
    ...mockPlanWithLimit,
    limits: []
};

/**
 * Addon definition: adds +20 to LIMIT_KEY.
 */
const mockAddonDefLimit20 = {
    slug: 'extra-accommodations-20',
    name: 'Extra Accommodations (+20)',
    description: '+20 accommodations',
    billingType: 'recurring' as const,
    priceArs: 800000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/**
 * Active subscription in the trialing state (still valid for recalculation).
 */
const mockActiveSubscription = {
    id: 'sub_test_001',
    customerId: CUSTOMER_ID,
    planId: PLAN_SLUG,
    status: 'active' as const
};

const mockTrialingSubscription = {
    ...mockActiveSubscription,
    status: 'trialing' as const
};

/**
 * A purchase row for 'extra-accommodations-20' contributing +20 to LIMIT_KEY.
 */
const activePurchaseRow = {
    id: 'purch_001',
    customerId: CUSTOMER_ID,
    addonSlug: 'extra-accommodations-20',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 20 }],
    entitlementAdjustments: []
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Configures the DB mock chain to return the given purchases array,
 * and returns a db-like object to pass to the function under test.
 */
function setupDbWithPurchases(purchases: unknown[]): { select: typeof mockDbSelect } {
    mockDbWhere.mockResolvedValue(purchases);
    return { select: mockDbSelect };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('recalculateAddonLimitsForCustomer', () => {
    let billing: QZPayBilling;

    beforeEach(async () => {
        vi.clearAllMocks();

        billing = createMockBilling();
        (billing.limits.set as unknown as MockInstance).mockResolvedValue(undefined);
        (billing.limits.removeBySource as unknown as MockInstance).mockResolvedValue(0);
        (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue([
            mockActiveSubscription
        ]);

        // Default: plan found with base limit 10
        const { getPlanBySlug, getAddonBySlug } = await import('@repo/billing');
        (getPlanBySlug as unknown as MockInstance).mockReturnValue(mockPlanWithLimit);
        (getAddonBySlug as unknown as MockInstance).mockReturnValue(mockAddonDefLimit20);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // T-019-1: Single addon — basePlanLimit + addonIncrement applied via limits.set
    // =========================================================================
    describe('T-019-1: single addon — limits.set called with basePlanLimit + addonIncrement', () => {
        it('should call limits.set with newMaxValue = basePlanLimit(10) + addonIncrement(20) = 30', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.set).toHaveBeenCalledOnce();
            expect(billing.limits.set).toHaveBeenCalledWith({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                maxValue: 30,
                source: 'addon',
                sourceId: ADDON_RECALC_SOURCE_ID
            });
            expect(result.outcome).toBe('success');
            expect(result.newMaxValue).toBe(30);
            expect(result.oldMaxValue).toBe(10);
            expect(result.addonCount).toBe(1);
            expect(result.limitKey).toBe(LIMIT_KEY);
        });

        it('should not call removeBySource when there are active addons', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.removeBySource).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // T-019-2: Multiple addons same limitKey — increments are SUM'd
    // =========================================================================
    describe('T-019-2: multiple addons for the same limitKey — SUM of increments applied', () => {
        it('should sum +20 + +20 = +40 and set newMaxValue = 10 + 40 = 50', async () => {
            // Arrange — two active purchases, each contributing +20
            const secondPurchase = {
                ...activePurchaseRow,
                id: 'purch_002'
            };
            const db = setupDbWithPurchases([activePurchaseRow, secondPurchase]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 50 })
            );
            expect(result.newMaxValue).toBe(50);
            expect(result.oldMaxValue).toBe(10);
            expect(result.addonCount).toBe(2);
            expect(result.outcome).toBe('success');
        });

        it('should sum different increment amounts correctly', async () => {
            // Arrange — two purchases with different increments (20 and 10)
            const smallAddonPurchase = {
                id: 'purch_003',
                customerId: CUSTOMER_ID,
                addonSlug: 'extra-accommodations-10',
                status: 'active',
                deletedAt: null,
                limitAdjustments: [{ limitKey: LIMIT_KEY, increase: 10 }],
                entitlementAdjustments: []
            };
            const db = setupDbWithPurchases([activePurchaseRow, smallAddonPurchase]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — 10 base + 20 + 10 = 40
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 40 })
            );
            expect(result.newMaxValue).toBe(40);
        });
    });

    // =========================================================================
    // T-019-3: No remaining addons — removeBySource cleans up stale aggregated limit
    // =========================================================================
    describe('T-019-3: no remaining addons — removeBySource removes stale aggregated limit', () => {
        it('should call removeBySource with ADDON_RECALC_SOURCE_ID when no active purchases', async () => {
            // Arrange — empty DB result (no active purchases for this customer)
            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(billing.limits.removeBySource).toHaveBeenCalledOnce();
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                ADDON_RECALC_SOURCE_ID
            );
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(result.outcome).toBe('success');
            expect(result.newMaxValue).toBe(10);
            expect(result.addonCount).toBe(0);
        });

        it('should call removeBySource when purchases exist but none match limitKey', async () => {
            // Arrange — purchase for a different limitKey
            const { getAddonBySlug } = await import('@repo/billing');

            // Make getAddonBySlug return a definition for a DIFFERENT limitKey
            (getAddonBySlug as unknown as MockInstance).mockReturnValue({
                ...mockAddonDefLimit20,
                affectsLimitKey: 'max_photos_per_accommodation'
            });

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — no relevant addon, so stale limit must be cleaned
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                ADDON_RECALC_SOURCE_ID
            );
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(result.outcome).toBe('success');
            expect(result.addonCount).toBe(0);
        });
    });

    // =========================================================================
    // T-019-4: Unlimited base plan (-1) — recalculation skipped
    // =========================================================================
    describe('T-019-4: unlimited base plan — recalculation skipped with outcome=skipped', () => {
        it('should return outcome=skipped and not call limits.set or removeBySource', async () => {
            // Arrange
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(mockPlanUnlimited);

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('skipped');
            expect(result.oldMaxValue).toBe(-1);
            expect(result.newMaxValue).toBe(-1);
            expect(result.reason).toBeDefined();
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(billing.limits.removeBySource).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // T-019-5: Plan not found in config — outcome='failed'
    // =========================================================================
    describe('T-019-5: plan not found in canonical config — outcome=failed', () => {
        it('should return outcome=failed when getPlanBySlug returns null', async () => {
            // Arrange
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(null);

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain(PLAN_SLUG);
            expect(result.newMaxValue).toBe(0);
            expect(result.oldMaxValue).toBe(0);
            expect(billing.limits.set).not.toHaveBeenCalled();
            expect(billing.limits.removeBySource).not.toHaveBeenCalled();
        });

        it('should return outcome=failed when getPlanBySlug returns undefined', async () => {
            // Arrange
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(undefined);

            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.addonCount).toBe(0);
        });
    });

    // =========================================================================
    // T-019-6: limitKey not present in plan limits — basePlanLimit treated as 0
    // =========================================================================
    describe('T-019-6: limitKey missing from plan limits array — basePlanLimit defaults to 0', () => {
        it('should treat basePlanLimit as 0 and still call limits.set with correct newMaxValue', async () => {
            // Arrange — plan has no entry for LIMIT_KEY
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(mockPlanWithoutLimitKey);

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — base is 0, addon adds 20 → newMaxValue = 0 + 20 = 20
            expect(result.outcome).toBe('success');
            expect(result.oldMaxValue).toBe(0);
            expect(result.newMaxValue).toBe(20);
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 20 })
            );
        });

        it('should call removeBySource when no addons and limitKey is missing from plan', async () => {
            // Arrange — plan without limitKey, no active purchases either
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(mockPlanWithoutLimitKey);

            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — base 0 + increment 0 → cleanup path
            expect(result.outcome).toBe('success');
            expect(result.oldMaxValue).toBe(0);
            expect(result.newMaxValue).toBe(0);
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                ADDON_RECALC_SOURCE_ID
            );
        });
    });

    // =========================================================================
    // T-019-7: No active subscription — outcome='failed'
    // =========================================================================
    describe('T-019-7: no active subscription — outcome=failed', () => {
        it('should return outcome=failed when subscriptions array is empty', async () => {
            // Arrange
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue(
                []
            );

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('no subscriptions');
            expect(billing.limits.set).not.toHaveBeenCalled();
        });

        it('should return outcome=failed when all subscriptions are in non-active states', async () => {
            // Arrange — subscription exists but is canceled (not active/trialing)
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue([
                { ...mockActiveSubscription, status: 'canceled' }
            ]);

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('active');
            expect(billing.limits.set).not.toHaveBeenCalled();
        });

        it('should accept trialing subscription as valid', async () => {
            // Arrange — trialing status must be treated the same as active
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue([
                mockTrialingSubscription
            ]);

            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — trialing is valid, recalculation should succeed
            expect(result.outcome).toBe('success');
            expect(billing.limits.set).toHaveBeenCalledOnce();
        });

        it('should return outcome=failed when getByCustomerId returns null', async () => {
            // Arrange
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue(
                null
            );

            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
        });
    });

    // =========================================================================
    // T-019-8: Purchase with no matching limitAdjustment — contribution is 0
    // =========================================================================
    describe('T-019-8: purchase with no matching limitAdjustment entry — contribution is 0', () => {
        it('should skip a purchase that has no limitAdjustment for the target limitKey', async () => {
            // Arrange — purchase exists, addon def matches limitKey, but limitAdjustments
            // array does NOT contain an entry for the target limitKey
            const purchaseWithoutAdjustment = {
                ...activePurchaseRow,
                id: 'purch_no_adj',
                limitAdjustments: [{ limitKey: 'max_photos_per_accommodation', increase: 5 }]
            };
            const db = setupDbWithPurchases([purchaseWithoutAdjustment]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — addonCount is 1 (purchase matched the limitKey filter), but
            // the limitAdjustments entry for LIMIT_KEY is missing → increment is 0
            // → cleanup path (removeBySource) instead of set
            expect(result.outcome).toBe('success');
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                ADDON_RECALC_SOURCE_ID
            );
            expect(billing.limits.set).not.toHaveBeenCalled();
        });

        it('should skip a purchase that has an empty limitAdjustments array', async () => {
            // Arrange
            const purchaseWithEmptyAdjustments = {
                ...activePurchaseRow,
                id: 'purch_empty_adj',
                limitAdjustments: []
            };
            const db = setupDbWithPurchases([purchaseWithEmptyAdjustments]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — no usable increment found → cleanup path
            expect(result.outcome).toBe('success');
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                'addon',
                ADDON_RECALC_SOURCE_ID
            );
            expect(billing.limits.set).not.toHaveBeenCalled();
        });

        it('should correctly combine a purchase with adjustment and one without', async () => {
            // Arrange — one purchase has the adjustment (+20), one does not
            const purchaseWithoutMatchingAdj = {
                ...activePurchaseRow,
                id: 'purch_no_match',
                limitAdjustments: [{ limitKey: 'max_photos_per_accommodation', increase: 50 }]
            };
            const db = setupDbWithPurchases([activePurchaseRow, purchaseWithoutMatchingAdj]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — only first purchase contributes: 10 base + 20 = 30
            expect(result.outcome).toBe('success');
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 30 })
            );
        });
    });

    // =========================================================================
    // Return type shape — RecalculationResult contract
    // =========================================================================
    describe('return type shape — RecalculationResult fields', () => {
        it('should always include limitKey, oldMaxValue, newMaxValue, addonCount, outcome', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — all required fields present with correct types
            expect(typeof result.limitKey).toBe('string');
            expect(typeof result.oldMaxValue).toBe('number');
            expect(typeof result.newMaxValue).toBe('number');
            expect(typeof result.addonCount).toBe('number');
            expect(['success', 'skipped', 'failed']).toContain(result.outcome);
        });

        it('should include reason field on skipped outcome', async () => {
            // Arrange — unlimited plan triggers skipped path
            const { getPlanBySlug } = await import('@repo/billing');
            (getPlanBySlug as unknown as MockInstance).mockReturnValue(mockPlanUnlimited);
            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('skipped');
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
        });

        it('should include reason field on failed outcome', async () => {
            // Arrange — no subscription triggers failed path
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockResolvedValue(
                []
            );
            const db = setupDbWithPurchases([]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toBeDefined();
            expect(typeof result.reason).toBe('string');
        });

        it('should not include reason field on success outcome', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('success');
            expect(result.reason).toBeUndefined();
        });
    });

    // =========================================================================
    // Unexpected errors — caught and returned as failed
    // =========================================================================
    describe('unexpected error handling — outer catch block', () => {
        it('should return outcome=failed when billing.limits.set throws unexpectedly', async () => {
            // Arrange
            (billing.limits.set as unknown as MockInstance).mockRejectedValue(
                new Error('Redis connection lost')
            );
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act — must NOT throw; outer catch converts to failed result
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('Redis connection lost');
        });

        it('should return outcome=failed when subscriptions.getByCustomerId throws', async () => {
            // Arrange
            (billing.subscriptions.getByCustomerId as unknown as MockInstance).mockRejectedValue(
                new Error('QZPay service unreachable')
            );
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            const result = await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert
            expect(result.outcome).toBe('failed');
            expect(result.reason).toContain('QZPay service unreachable');
        });
    });

    // =========================================================================
    // GAP-043-037: Enhanced toHaveBeenCalledWith assertions for limits.set
    // =========================================================================
    describe('GAP-043-037: enhanced call argument assertions for limits.set and removeBySource', () => {
        it('should call limits.set with objectContaining maxValue as a number and sourceId as a string', async () => {
            // Arrange
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — shape-based: maxValue is a number, sourceId is a string
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    maxValue: expect.any(Number),
                    sourceId: expect.any(String),
                    customerId: CUSTOMER_ID,
                    limitKey: LIMIT_KEY,
                    source: 'addon'
                })
            );
        });

        it('should call limits.set with the exact computed maxValue (basePlan + addons)', async () => {
            // Arrange — base=10, addon increment=20 → expected maxValue=30
            const db = setupDbWithPurchases([activePurchaseRow]);

            // Act
            await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — exact numeric value
            expect(billing.limits.set).toHaveBeenCalledWith(
                expect.objectContaining({ maxValue: 30 })
            );
        });

        it('should call limits.removeBySource with ("addon", ADDON_RECALC_SOURCE_ID) when no active addons', async () => {
            // Arrange — no purchases → cleanup path
            const db = setupDbWithPurchases([]);

            // Act
            await recalculateAddonLimitsForCustomer({
                customerId: CUSTOMER_ID,
                limitKey: LIMIT_KEY,
                billing,
                db: db as never
            });

            // Assert — removeBySource called with source="addon" and the constant sourceId
            expect(billing.limits.removeBySource).toHaveBeenCalledWith(
                expect.stringContaining('addon'),
                expect.stringContaining(ADDON_RECALC_SOURCE_ID)
            );
        });
    });
});
