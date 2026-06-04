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
    mockTxExecute,
    mockWithTransaction,
    mockBillingAddonPurchasesSchema,
    mockAddonCatalogGetBySlug,
    mockPlanServiceGetById,
    mockPlanServiceGetBySlug
} = vi.hoisted(() => {
    const mockTxExecute = vi.fn().mockResolvedValue({ rows: [] });
    const tx = { execute: mockTxExecute };
    const mockWithTransaction = vi.fn(async <T>(callback: (innerTx: typeof tx) => Promise<T>) => {
        return callback(tx);
    });

    const mockBillingAddonPurchasesSchema = {
        customerId: 'customerId',
        status: 'status',
        deletedAt: 'deletedAt'
    };

    // DB-backed catalog mock — returns NOT_FOUND by default; tests override per-case.
    const mockAddonCatalogGetBySlug = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Add-on not found' }
    });

    // DB-backed plan service mocks — getById returns NOT_FOUND (planId is a slug,
    // so the UUID lookup always misses); getBySlug is the effective lookup path.
    const mockPlanServiceGetById = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });
    const mockPlanServiceGetBySlug = vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Plan not found' }
    });

    return {
        mockTxExecute,
        mockWithTransaction,
        mockBillingAddonPurchasesSchema,
        mockAddonCatalogGetBySlug,
        mockPlanServiceGetById,
        mockPlanServiceGetBySlug
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

vi.mock('@repo/db', () => ({
    withTransaction: mockWithTransaction,
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        type: 'sql'
    }))
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesSchema
}));

// @repo/billing is no longer used for plan/addon resolution in the production
// recalculation service (cutover SPEC-192 T-027). Keep a passthrough mock so
// any remaining transitive imports don't break.
vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return { ...actual };
});

// DB-backed services: AddonCatalogService and PlanService are module-level
// singletons in addon-limit-recalculation.service.ts (service-core source).
// They are instantiated via RELATIVE imports, so we mock the specific files
// rather than the @repo/service-core package alias.
vi.mock(
    '../../../../packages/service-core/src/services/billing/addon/addon-catalog.service',
    () => ({
        AddonCatalogService: vi.fn().mockImplementation(() => ({
            getBySlug: mockAddonCatalogGetBySlug,
            list: vi.fn().mockResolvedValue({ success: true, data: [] })
        }))
    })
);

vi.mock('../../../../packages/service-core/src/services/billing/plan/plan.service', () => ({
    PlanService: vi.fn().mockImplementation(() => ({
        getById: mockPlanServiceGetById,
        getBySlug: mockPlanServiceGetBySlug
    }))
}));

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
 * DB shape: limits is Record<string, number> (not an array).
 */
const mockPlanWithLimit = {
    id: 'plan-uuid-owner-pro',
    slug: PLAN_SLUG,
    name: 'Owner Pro',
    description: 'Pro plan',
    category: 'owner' as const,
    monthlyPriceArs: 5000,
    annualPriceArs: null,
    monthlyPriceUsdRef: 5,
    hasTrial: false,
    trialDays: 0,
    isDefault: false,
    sortOrder: 2,
    entitlements: [],
    limits: { [LIMIT_KEY]: 10 } as Record<string, number>,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

/**
 * Plan where the limitKey has value -1 (unlimited).
 */
const mockPlanUnlimited = {
    ...mockPlanWithLimit,
    limits: { [LIMIT_KEY]: -1 } as Record<string, number>
};

/**
 * Plan that does NOT have the limitKey in its limits map.
 */
const mockPlanWithoutLimitKey = {
    ...mockPlanWithLimit,
    limits: {} as Record<string, number>
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
 * Configures the transaction mock to return the given purchases array
 * when tx.execute() is called, and returns a db-like object to pass to
 * the function under test (the db parameter is now ignored by the source
 * but still required by the interface for backward compatibility).
 */
function setupDbWithPurchases(purchases: unknown[]): Record<string, unknown> {
    mockTxExecute.mockResolvedValue({ rows: purchases });
    return {};
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

        // Default: plan found with base limit 10 via DB-backed PlanService.
        // The production code does dual-resolve: getById(planId) then getBySlug(planId).
        // Since mockActiveSubscription.planId is a slug, getById returns NOT_FOUND and
        // getBySlug is the effective resolution path.
        mockPlanServiceGetById.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Plan not found' }
        });
        mockPlanServiceGetBySlug.mockResolvedValue({
            success: true,
            data: mockPlanWithLimit
        });

        // Default: addon definition found with affectsLimitKey = LIMIT_KEY.
        mockAddonCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: mockAddonDefLimit20
        });
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
            // Make catalogService.getBySlug return a definition for a DIFFERENT limitKey
            mockAddonCatalogGetBySlug.mockResolvedValue({
                success: true,
                data: {
                    ...mockAddonDefLimit20,
                    affectsLimitKey: 'max_photos_per_accommodation'
                }
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
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: true,
                data: mockPlanUnlimited
            });

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
    describe('T-019-5: plan not found in DB — outcome=failed', () => {
        it('should return outcome=failed when plan not found in DB (getById + getBySlug both fail)', async () => {
            // Arrange — both PlanService lookups return NOT_FOUND
            mockPlanServiceGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found' }
            });
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found' }
            });

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

        it('should return outcome=failed when getBySlug also returns NOT_FOUND', async () => {
            // Arrange — both lookups fail (covers old "undefined" fallback path)
            mockPlanServiceGetById.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found' }
            });
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: false,
                error: { code: 'NOT_FOUND', message: 'Plan not found' }
            });

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
    describe('T-019-6: limitKey missing from plan limits map — basePlanLimit defaults to 0', () => {
        it('should treat basePlanLimit as 0 and still call limits.set with correct newMaxValue', async () => {
            // Arrange — plan has no entry for LIMIT_KEY in its limits map
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: true,
                data: mockPlanWithoutLimitKey
            });

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
            // Arrange — plan without limitKey in its limits map, no active purchases either
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: true,
                data: mockPlanWithoutLimitKey
            });

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
            mockPlanServiceGetBySlug.mockResolvedValue({
                success: true,
                data: mockPlanUnlimited
            });
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
