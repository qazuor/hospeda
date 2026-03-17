/**
 * Tests for cancelUserAddon() — AC-3.9 limit recalculation branch
 *
 * Covers:
 * - T-AC39-1: limit-type addon triggers recalculateAddonLimitsForCustomer with correct limitKey
 * - T-AC39-2: entitlement-type addon does NOT trigger recalculation
 * - T-AC39-3: unknown addon slug (getAddonBySlug returns undefined) does NOT trigger recalculation
 * - T-AC39-4: recalculateAddonLimitsForCustomer throws — error swallowed, cancelUserAddon still succeeds
 * - T-AC39-5: recalculateAddonLimitsForCustomer returns outcome 'failed' — warning logged, no crash
 *
 * @module test/services/addon-user-addons-recalc.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import type { RecalculationResult } from '../../src/services/addon-limit-recalculation.service';
import type { CancelAddonInput } from '../../src/services/addon.types';
import { cancelUserAddon } from '../../src/services/addon.user-addons';
import { createMockBilling } from '../helpers/mock-factories';

// ─── Hoisted mock setup ───────────────────────────────────────────────────────
//
// All DB chain functions are hoisted so they are available when vi.mock() runs.
// The chain for select is:  select() -> from() -> where() -> limit()
// The chain for update is:  update() -> set() -> where()

const {
    mockDbSelectLimit,
    mockDbSelect,
    mockDbUpdateWhere,
    mockDbUpdate,
    mockBillingAddonPurchasesTable,
    mockRecalculate,
    mockGetAddonBySlug
} = vi.hoisted(() => {
    // ── select chain: select() -> from() -> where() -> limit() ────────────────
    const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
    const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }));
    const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbSelectFrom }));

    // ── update chain: update() -> set() -> where() ────────────────────────────
    const mockDbUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
    const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

    // ── schema columns object ──────────────────────────────────────────────────
    const mockBillingAddonPurchasesTable = {
        id: 'id',
        customerId: 'customerId',
        addonSlug: 'addonSlug',
        status: 'status',
        canceledAt: 'canceledAt',
        updatedAt: 'updatedAt',
        deletedAt: 'deletedAt'
    };

    // ── recalculation service mock ────────────────────────────────────────────
    const mockRecalculate = vi.fn();

    // ── billing addon slug mock ───────────────────────────────────────────────
    const mockGetAddonBySlug = vi.fn();

    return {
        mockDbSelectLimit,
        mockDbSelect,
        mockDbUpdateWhere,
        mockDbUpdate,
        mockBillingAddonPurchasesTable,
        mockRecalculate,
        mockGetAddonBySlug
    };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect,
        update: mockDbUpdate
    }))
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesTable
}));

vi.mock('../../src/services/addon-limit-recalculation.service', () => ({
    recalculateAddonLimitsForCustomer: (...args: unknown[]) => mockRecalculate(...args)
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: (slug: string) => mockGetAddonBySlug(slug)
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust_test_001';
const PURCHASE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const ADDON_SLUG_LIMIT = 'extra-photos-20';
const ADDON_SLUG_ENT = 'visibility-boost-7d';
const ADDON_SLUG_UNKNOWN = 'retired-addon-slug';
const LIMIT_KEY = 'max_photos_per_accommodation';

/** Minimal limit-type addon definition (affectsLimitKey is set) */
const limitAddonDef: AddonDefinition = {
    slug: ADDON_SLUG_LIMIT,
    name: 'Extra Photos Pack (+20)',
    description: 'Extra photos',
    billingType: 'recurring',
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: null,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 3
};

/** Minimal entitlement-type addon definition (affectsLimitKey is null) */
const entitlementAddonDef: AddonDefinition = {
    slug: ADDON_SLUG_ENT,
    name: 'Visibility Boost (7 days)',
    description: 'Featured listing for 7 days',
    billingType: 'one_time',
    priceArs: 500000,
    annualPriceArs: null,
    durationDays: 7,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: 'FEATURED_LISTING',
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** Default successful recalculation result */
const successRecalcResult: RecalculationResult = {
    limitKey: LIMIT_KEY,
    oldMaxValue: 5,
    newMaxValue: 25,
    addonCount: 1,
    outcome: 'success'
};

/** Default cancel input */
const defaultInput: CancelAddonInput = {
    customerId: CUSTOMER_ID,
    purchaseId: PURCHASE_ID,
    userId: 'user_test_001',
    reason: 'No longer needed'
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock of AddonEntitlementService.
 * removeAddonEntitlements always succeeds by default.
 */
function createMockEntitlementService(): AddonEntitlementService {
    return {
        applyAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined }),
        getCustomerAddonAdjustments: vi.fn().mockResolvedValue({ success: true, data: [] })
    } as unknown as AddonEntitlementService;
}

/**
 * Configures the hoisted DB select mock to return a specific purchase row.
 * Pass null to simulate a "not found" scenario (empty array).
 */
function setupPurchaseLookup(
    purchase: {
        id: string;
        addonSlug: string;
        status: string;
        customerId: string;
    } | null
): void {
    mockDbSelectLimit.mockResolvedValue(purchase ? [purchase] : []);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cancelUserAddon — AC-3.9 limit recalculation', () => {
    let mockBilling: QZPayBilling;
    let mockEntitlementService: AddonEntitlementService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockBilling = createMockBilling();
        mockEntitlementService = createMockEntitlementService();

        // Default: recalculation succeeds
        mockRecalculate.mockResolvedValue(successRecalcResult);

        // Default: DB update succeeds with 1 row affected
        mockDbUpdateWhere.mockResolvedValue({ rowCount: 1 });

        // Default: getAddonBySlug resolves to limit addon (overridden per test)
        mockGetAddonBySlug.mockReturnValue(limitAddonDef);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-AC39-1: limit-type addon triggers recalculation with correct limitKey
    // =========================================================================

    describe('T-AC39-1: limit-type addon triggers recalculation', () => {
        it('should call recalculateAddonLimitsForCustomer with the correct customerId and limitKey', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRecalculate).toHaveBeenCalledOnce();
            expect(mockRecalculate).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    limitKey: LIMIT_KEY,
                    billing: mockBilling
                })
            );
        });

        it('should pass a db object to recalculateAddonLimitsForCustomer', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — db must be forwarded (not undefined or null)
            expect(mockRecalculate).toHaveBeenCalledWith(
                expect.objectContaining({
                    db: expect.objectContaining({ select: expect.any(Function) })
                })
            );
        });

        it('should return success when recalculation outcome is success', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            mockRecalculate.mockResolvedValue({ ...successRecalcResult, outcome: 'success' });

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should still call removeAddonEntitlements before recalculation', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — entitlement removal always runs before recalculation
            expect(mockEntitlementService.removeAddonEntitlements).toHaveBeenCalledOnce();
            expect(mockRecalculate).toHaveBeenCalledOnce();
        });
    });

    // =========================================================================
    // T-AC39-2: entitlement-type addon does NOT trigger recalculation
    // =========================================================================

    describe('T-AC39-2: entitlement-type addon — recalculation NOT called', () => {
        it('should NOT call recalculateAddonLimitsForCustomer when affectsLimitKey is null', async () => {
            // Arrange — entitlementAddonDef.affectsLimitKey is null
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_ENT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(entitlementAddonDef);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRecalculate).not.toHaveBeenCalled();
        });

        it('should still call removeAddonEntitlements for an entitlement-type addon', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_ENT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(entitlementAddonDef);

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — entitlement removal must always run
            expect(mockEntitlementService.removeAddonEntitlements).toHaveBeenCalledOnce();
        });
    });

    // =========================================================================
    // T-AC39-3: unknown addon slug — recalculation NOT called
    // =========================================================================

    describe('T-AC39-3: unknown addon slug — recalculation NOT called', () => {
        it('should NOT call recalculateAddonLimitsForCustomer when getAddonBySlug returns undefined', async () => {
            // Arrange — retired/unknown addons have no definition, so we cannot
            // determine whether they are limit-type. Recalculation is skipped.
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_UNKNOWN,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(undefined);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(true);
            expect(mockRecalculate).not.toHaveBeenCalled();
        });

        it('should return success even when the addon definition is missing', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_UNKNOWN,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(undefined);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — the cancel itself still succeeds; the missing def is non-fatal
            expect(result.success).toBe(true);
        });
    });

    // =========================================================================
    // T-AC39-4: recalculation throws — error swallowed, function still succeeds
    // =========================================================================

    describe('T-AC39-4: recalculation throws — cancelUserAddon still succeeds', () => {
        it('should return success when recalculateAddonLimitsForCustomer throws', async () => {
            // Arrange: the addon is already marked canceled in the DB before
            // recalculation runs. A throw from recalculate must not surface.
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            mockRecalculate.mockRejectedValue(new Error('QZPay network error'));

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — addon cancel succeeded; recalc error must not propagate
            expect(result.success).toBe(true);
        });

        it('should log an error when recalculateAddonLimitsForCustomer throws', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            const recalcError = new Error('Billing service unavailable');
            mockRecalculate.mockRejectedValue(recalcError);

            const { apiLogger } = await import('../../src/utils/logger');

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — the error catch block must log
            expect(vi.mocked(apiLogger.error)).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: recalcError.message,
                    customerId: CUSTOMER_ID,
                    purchaseId: PURCHASE_ID,
                    limitKey: LIMIT_KEY
                }),
                expect.stringContaining('Unexpected error during addon limit recalculation')
            );
        });

        it('should call recalculateAddonLimitsForCustomer exactly once even when it throws', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            mockRecalculate.mockRejectedValue(new Error('transient failure'));

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — there must be no retry; the code catches and moves on
            expect(mockRecalculate).toHaveBeenCalledOnce();
        });
    });

    // =========================================================================
    // T-AC39-5: recalculation returns outcome 'failed' — warning logged, no crash
    // =========================================================================

    describe('T-AC39-5: recalculation returns outcome failed — warning logged, no crash', () => {
        it('should return success when recalculateAddonLimitsForCustomer resolves with outcome failed', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            const failedResult: RecalculationResult = {
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0,
                outcome: 'failed',
                reason: 'Customer has no active subscription'
            };
            mockRecalculate.mockResolvedValue(failedResult);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — a graceful failed outcome must not propagate as a function failure
            expect(result.success).toBe(true);
        });

        it('should log a warning when recalculation outcome is failed', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            const failedResult: RecalculationResult = {
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0,
                outcome: 'failed',
                reason: 'Plan not found in canonical config'
            };
            mockRecalculate.mockResolvedValue(failedResult);

            const { apiLogger } = await import('../../src/utils/logger');

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — the warn branch in cancelUserAddon must fire
            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    purchaseId: PURCHASE_ID,
                    limitKey: LIMIT_KEY,
                    reason: failedResult.reason
                }),
                expect.stringContaining('Limit recalculation failed after addon cancellation')
            );
        });

        it('should NOT call apiLogger.error for a failed outcome result (only warn is expected)', async () => {
            // Arrange — outcome 'failed' uses warn, not error. error is only for thrown exceptions.
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            mockRecalculate.mockResolvedValue({
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0,
                outcome: 'failed' as const,
                reason: 'no subscription'
            });

            const { apiLogger } = await import('../../src/utils/logger');

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — filter error calls that contain a limitKey context key to
            // distinguish from unrelated DB/entitlement error log calls
            const recalcErrorCalls = vi.mocked(apiLogger.error).mock.calls.filter(([ctx]) => {
                if (typeof ctx !== 'object' || ctx === null) return false;
                return 'limitKey' in (ctx as Record<string, unknown>);
            });
            expect(recalcErrorCalls).toHaveLength(0);
        });
    });

    // =========================================================================
    // Pre-condition guards — recalculation must never be reached
    // =========================================================================

    describe('pre-condition guards', () => {
        it('should return NOT_FOUND and skip recalculation when purchase record does not exist', async () => {
            // Arrange — select returns empty array
            setupPurchaseLookup(null);
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(mockRecalculate).not.toHaveBeenCalled();
        });

        it('should return PERMISSION_DENIED and skip recalculation when purchase belongs to different customer', async () => {
            // Arrange — purchase belongs to a different customer
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: 'cust_other_999'
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('PERMISSION_DENIED');
            expect(mockRecalculate).not.toHaveBeenCalled();
        });

        it('should return NOT_FOUND and skip recalculation when purchase status is not active', async () => {
            // Arrange — already canceled purchase
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'canceled',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);

            // Act
            const result = await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('NOT_FOUND');
            expect(mockRecalculate).not.toHaveBeenCalled();
        });
    });
});
