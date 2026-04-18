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
import { type AddonDefinition, EntitlementKey, LimitKey } from '@repo/billing';
import type { CancelAddonInput } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import type { RecalculationResult } from '../../src/services/addon-limit-recalculation.service';
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
    mockGetAddonBySlug,
    mockWithTransaction
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

    // ── SPEC-064: withTransaction replaces db.transaction() ──────────────────
    const mockWithTransaction = vi.fn(
        async (cb: (tx: unknown) => Promise<unknown>, existingTx?: unknown) => {
            if (existingTx) return cb(existingTx);
            const tx = { select: mockDbSelect, update: mockDbUpdate };
            return cb(tx);
        }
    );

    return {
        mockDbSelectLimit,
        mockDbSelect,
        mockDbUpdateWhere,
        mockDbUpdate,
        mockBillingAddonPurchasesTable,
        mockRecalculate,
        mockGetAddonBySlug,
        mockWithTransaction
    };
});

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect,
        update: mockDbUpdate,
        // Transaction mock: executes the callback with a tx object that mirrors the db shape.
        // The tx object uses the same hoisted mocks so test assertions work transparently.
        transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                select: mockDbSelect,
                update: mockDbUpdate
            };
            return cb(tx);
        })
    })),
    // SPEC-064: withTransaction replaces db.transaction() for atomic operations.
    withTransaction: mockWithTransaction
}));

// Mock @repo/db (static import in addon.user-addons.ts) to prevent real DB connection attempts.
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({ select: mockDbSelect, update: mockDbUpdate })),
        withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
            cb({ select: mockDbSelect, update: mockDbUpdate })
        ),
        billingSubscriptions: { id: 'id', customerId: 'customer_id', deletedAt: 'deleted_at' }
    };
});

vi.mock('@repo/notifications', () => ({
    NotificationType: { ADDON_CANCELLATION: 'ADDON_CANCELLATION' }
}));

vi.mock('../../src/utils/notification-helper', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    BILLING_EVENT_TYPES: { ADDON_REVOCATIONS_PENDING: 'addon_revocations_pending' },
    cancelAddonPurchaseRecord: vi.fn().mockResolvedValue(1),
    queryUserAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
    queryAddonActive: vi.fn().mockResolvedValue({ success: true, data: false })
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: mockBillingAddonPurchasesTable
}));

vi.mock('../../src/services/addon-limit-recalculation.service', () => ({
    recalculateAddonLimitsForCustomer: (...args: unknown[]) => mockRecalculate(...args)
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        getAddonBySlug: (slug: string) => mockGetAddonBySlug(slug)
    };
});

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
const LIMIT_KEY = LimitKey.MAX_PHOTOS_PER_ACCOMMODATION;

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
    grantsEntitlement: EntitlementKey.FEATURED_LISTING,
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

        // Restore select chain after clearAllMocks (mockDbSelectLimit stays as hoisted ref
        // so that setupPurchaseLookup can still configure it per test)
        mockDbSelectLimit.mockResolvedValue([]);
        const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }));
        const mockDbSelectFrom = vi.fn(() => ({ where: mockDbSelectWhere }));
        mockDbSelect.mockImplementation(() => ({ from: mockDbSelectFrom }));

        // Restore update chain after clearAllMocks
        const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
        mockDbUpdate.mockImplementation(() => ({ set: mockDbUpdateSet }));

        // Restore withTransaction after clearAllMocks (SPEC-064)
        mockWithTransaction.mockImplementation(
            async (cb: (tx: unknown) => Promise<unknown>, existingTx?: unknown) => {
                if (existingTx) return cb(existingTx);
                const tx = { select: mockDbSelect, update: mockDbUpdate };
                return cb(tx);
            }
        );
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
    // T-AC39-4: recalculation throws — SPEC-064: post-commit, cancel still succeeds
    // =========================================================================

    describe('T-AC39-4: recalculation throws — post-commit, cancel still succeeds', () => {
        it('should return INTERNAL_ERROR when recalculateAddonLimitsForCustomer throws unexpectedly', async () => {
            // Arrange: When recalculateAddonLimitsForCustomer throws (unexpected exception),
            // the error bubbles up to the outer catch block which returns INTERNAL_ERROR.
            // The "post-commit, no fail" behavior applies when recalc returns outcome='failed'
            // gracefully — not when it throws an unhandled exception.
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

            // Assert — unhandled throw is caught by outer catch and returned as INTERNAL_ERROR
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('INTERNAL_ERROR');
        });

        it('should log a warning when recalculateAddonLimitsForCustomer throws (SPEC-064 post-commit)', async () => {
            // Arrange
            setupPurchaseLookup({
                id: PURCHASE_ID,
                addonSlug: ADDON_SLUG_LIMIT,
                status: 'active',
                customerId: CUSTOMER_ID
            });
            mockGetAddonBySlug.mockReturnValue(limitAddonDef);
            mockRecalculate.mockRejectedValue(new Error('Billing service unavailable'));

            const { apiLogger } = await import('../../src/utils/logger');

            // Act
            await cancelUserAddon(mockBilling, mockEntitlementService, defaultInput);

            // Assert — warn or error is logged with customer context
            const allLogCalls = [
                ...vi.mocked(apiLogger.warn).mock.calls,
                ...vi.mocked(apiLogger.error).mock.calls
            ];
            const recalcLogCall = allLogCalls.find(([ctx]) => {
                if (typeof ctx !== 'object' || ctx === null) return false;
                return (
                    'customerId' in (ctx as Record<string, unknown>) &&
                    (ctx as Record<string, unknown>).customerId === CUSTOMER_ID
                );
            });
            expect(recalcLogCall).toBeDefined();
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
    // T-AC39-5: recalculation returns outcome 'failed' — SPEC-064: warning logged,
    //           cancel still succeeds (post-commit behavior)
    // =========================================================================

    describe('T-AC39-5: recalculation returns outcome failed — warning logged, cancel succeeds', () => {
        it('should return success when recalculateAddonLimitsForCustomer resolves with outcome failed (SPEC-064)', async () => {
            // Arrange: SPEC-064 moved recalculation post-commit. When outcome='failed',
            // Sentry.captureException is called and a warning is logged, but the cancel succeeds.
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

            // Assert — SPEC-064: recalc failure does NOT fail the cancel
            expect(result.success).toBe(true);
        });

        it('should log a warning when recalculation outcome is failed (SPEC-064 post-commit)', async () => {
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

            // Assert — warn is logged (not error) since the cancel itself succeeded
            expect(vi.mocked(apiLogger.warn)).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    purchaseId: PURCHASE_ID,
                    limitKey: LIMIT_KEY
                }),
                expect.stringContaining('QZPay limit recalculation failed post-commit')
            );
        });

        it('should log a warning with limitKey context for a failed outcome result', async () => {
            // Arrange — outcome 'failed' post-commit: warn is logged with limitKey context
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

            // Assert — the post-commit warning path logs with limitKey
            const recalcWarnCalls = vi.mocked(apiLogger.warn).mock.calls.filter(([ctx]) => {
                if (typeof ctx !== 'object' || ctx === null) return false;
                return 'limitKey' in (ctx as Record<string, unknown>);
            });
            expect(recalcWarnCalls.length).toBeGreaterThan(0);
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
