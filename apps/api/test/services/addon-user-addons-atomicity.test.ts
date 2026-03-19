/**
 * Tests for cancelUserAddon() transaction atomicity — GAP-043-29
 *
 * Covers the critical behavior introduced in GAP-043-29:
 * - T-029-1: recalc fails → purchase is NOT marked as canceled (rollback)
 * - T-029-2: recalc succeeds → purchase IS marked as canceled
 * - T-029-3: recalc fails → Sentry.captureException is called
 * - T-029-4: non-limit addon → update uses direct DB path (no transaction)
 * - T-029-5: recalc outcome='skipped' → treated as success (no rollback)
 *
 * @module test/services/addon-user-addons-atomicity.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks — must be declared before imports ───────────────────────────

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn()
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customerId',
        status: 'status',
        addonSlug: 'addonSlug',
        deletedAt: 'deleted_at',
        canceledAt: 'canceled_at',
        updatedAt: 'updatedAt'
    }
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return {
        ...actual,
        and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
        eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
        isNull: vi.fn((col: unknown) => ({ type: 'isNull', col }))
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

vi.mock('../../src/services/addon-limit-recalculation.service', () => ({
    recalculateAddonLimitsForCustomer: vi.fn()
}));

vi.mock('@sentry/node', () => ({
    captureException: vi.fn()
}));

vi.mock('@repo/config', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual };
});

// Mock service-core addon-user-addons module for cancelAddonPurchaseRecord.
// After migration, the non-limit cancel path delegates to this function.
const { mockCancelAddonPurchaseRecord } = vi.hoisted(() => ({
    mockCancelAddonPurchaseRecord: vi.fn().mockResolvedValue(1)
}));

vi.mock('../../../../packages/service-core/src/services/billing/addon/addon-user-addons', () => ({
    queryUserAddons: vi.fn().mockResolvedValue({ success: true, data: [] }),
    queryAddonActive: vi.fn().mockResolvedValue({ success: true, data: false }),
    queryActiveAddonPurchases: vi.fn().mockResolvedValue([]),
    cancelAddonPurchaseRecord: mockCancelAddonPurchaseRecord
}));

// ─── Hoisted DB mock ──────────────────────────────────────────────────────────

const { mockTxUpdate, mockDbSelect, mockDbUpdate, mockDbTransaction } = vi.hoisted(() => {
    // Transaction-internal update chain
    const mockTxUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockTxUpdateSet = vi.fn(() => ({ where: mockTxUpdateWhere }));
    const mockTxUpdate = vi.fn(() => ({ set: mockTxUpdateSet }));

    // Outer select chain: select() -> from() -> where() -> limit()
    const mockDbLimit = vi.fn().mockResolvedValue([]);
    const mockDbWhere = vi.fn(() => ({ limit: mockDbLimit }));
    const mockDbFrom = vi.fn(() => ({ where: mockDbWhere }));
    const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

    // Outer update chain (used when no limit recalc needed)
    const mockDbUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
    const mockDbUpdate = vi.fn(() => ({ set: mockDbUpdateSet }));

    // Transaction: executes callback with tx that has an update method
    const mockDbTransaction = vi.fn(
        async (callback: (tx: { update: typeof mockTxUpdate }) => Promise<unknown>) => {
            return callback({ update: mockTxUpdate });
        }
    );

    return { mockTxUpdate, mockDbSelect, mockDbUpdate, mockDbTransaction };
});

vi.mock('@repo/db/client', () => ({
    getDb: vi.fn(() => ({
        select: mockDbSelect,
        update: mockDbUpdate,
        transaction: mockDbTransaction
    }))
}));

// ─── Constants & fixtures ─────────────────────────────────────────────────────

const CUSTOMER_ID = 'cust_atomicity_test';
const PURCHASE_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const LIMIT_KEY = 'max_accommodations';

const activeLimitAddonPurchase = {
    id: PURCHASE_ID,
    addonSlug: 'extra-accommodations-20',
    status: 'active',
    customerId: CUSTOMER_ID
};

const activeNonLimitAddonPurchase = {
    id: PURCHASE_ID,
    addonSlug: 'boost-7',
    status: 'active',
    customerId: CUSTOMER_ID
};

/** Addon definition that affects a limitKey. */
const limitAddonDef = {
    slug: 'extra-accommodations-20',
    name: 'Extra Accommodations',
    billingType: 'recurring' as const,
    priceArs: 800000,
    affectsLimitKey: LIMIT_KEY,
    limitIncrease: 20,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 1
};

/** Addon definition that does NOT affect any limit. */
const nonLimitAddonDef = {
    slug: 'boost-7',
    name: 'Boost 7d',
    billingType: 'one_time' as const,
    priceArs: 5000,
    affectsLimitKey: null,
    limitIncrease: null,
    grantsEntitlement: null,
    targetCategories: ['owner'],
    isActive: true,
    sortOrder: 2
};

const cancelInput = {
    customerId: CUSTOMER_ID,
    purchaseId: PURCHASE_ID,
    userId: 'user_test',
    reason: 'Test cancellation'
};

/**
 * Sets the DB select mock to return the given purchase record via the
 * select()->from()->where()->limit() chain.
 */
function mockSelectReturningPurchase(
    purchase: { id: string; addonSlug: string; status: string; customerId: string } | null
): void {
    const records = purchase ? [purchase] : [];
    const mockLimit = vi.fn().mockResolvedValue(records);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockDbSelect.mockImplementationOnce(() => ({ from: mockFrom }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('cancelUserAddon() atomicity — GAP-043-29', () => {
    let mockBilling: QZPayBilling;
    let mockEntitlementService: { removeAddonEntitlements: MockInstance };

    beforeEach(async () => {
        vi.clearAllMocks();

        mockBilling = {
            subscriptions: { getByCustomerId: vi.fn() },
            limits: { set: vi.fn(), removeBySource: vi.fn() }
        } as unknown as QZPayBilling;

        mockEntitlementService = {
            removeAddonEntitlements: vi.fn().mockResolvedValue({ success: true, data: undefined })
        };

        // Restore tx.update chain after clearAllMocks wipes the default implementations.
        const mockTxUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
        const mockTxUpdateSet = vi.fn(() => ({ where: mockTxUpdateWhere }));
        mockTxUpdate.mockImplementation(() => ({ set: mockTxUpdateSet }));

        // Restore db.update chain (used for non-limit addons).
        const mockDbUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
        const mockDbUpdateSet = vi.fn(() => ({ where: mockDbUpdateWhere }));
        mockDbUpdate.mockImplementation(() => ({ set: mockDbUpdateSet }));

        // Default: transaction executes callback correctly
        mockDbTransaction.mockImplementation(
            async (callback: (tx: { update: typeof mockTxUpdate }) => Promise<unknown>) => {
                return callback({ update: mockTxUpdate });
            }
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // T-029-1: recalc fails → purchase is NOT marked as canceled (rollback)
    // =========================================================================
    describe('T-029-1: recalc fails → transaction rolled back, purchase stays active', () => {
        it('should return LIMIT_RECALCULATION_FAILED and not persist canceled status when recalc fails', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'failed',
                reason: 'Customer has no active subscription',
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0
            });

            // Transaction rollback simulation: when callback throws, transaction re-throws
            mockDbTransaction.mockImplementation(
                async (callback: (tx: { update: typeof mockTxUpdate }) => Promise<unknown>) => {
                    return await callback({ update: mockTxUpdate });
                }
            );

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            const result = await cancelUserAddon(
                mockBilling,
                mockEntitlementService as never,
                cancelInput
            );

            // Assert: service returns failure
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('LIMIT_RECALCULATION_FAILED');
            expect(result.error?.message).toContain('rolled back');
        });

        it('should NOT persist status=canceled in the DB when recalc fails (rollback verification)', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'failed',
                reason: 'Plan not found in canonical config',
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0
            });

            // Simulate transaction rollback: callback throws, tx.update was called but is undone
            let txUpdateWasCalled = false;
            const captureUpdate = vi.fn(() => {
                txUpdateWasCalled = true;
                return {
                    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue({ rowCount: 1 }) }))
                };
            });

            mockDbTransaction.mockImplementation(
                async (callback: (tx: { update: typeof mockTxUpdate }) => Promise<unknown>) => {
                    return await callback({ update: captureUpdate });
                }
            );

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            const result = await cancelUserAddon(
                mockBilling,
                mockEntitlementService as never,
                cancelInput
            );

            // Assert: result is failure and outer db.update was NOT called (only tx.update inside
            // the rolled-back transaction was called, but that is discarded by the rollback)
            expect(result.success).toBe(false);
            expect(txUpdateWasCalled).toBe(true); // update was attempted inside transaction
            expect(mockDbUpdate).not.toHaveBeenCalled(); // outer direct update was NOT used
        });
    });

    // =========================================================================
    // T-029-2: recalc succeeds → purchase IS marked as canceled
    // =========================================================================
    describe('T-029-2: recalc succeeds → purchase is marked canceled and result is success', () => {
        it('should return success and call tx.update with status=canceled when recalc succeeds', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'success',
                limitKey: LIMIT_KEY,
                oldMaxValue: 10,
                newMaxValue: 30,
                addonCount: 1
            });

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            const result = await cancelUserAddon(
                mockBilling,
                mockEntitlementService as never,
                cancelInput
            );

            // Assert: success returned
            expect(result.success).toBe(true);

            // The transaction was entered
            expect(mockDbTransaction).toHaveBeenCalledOnce();

            // tx.update was called inside the transaction with status=canceled
            expect(mockTxUpdate).toHaveBeenCalled();
            const setCall = vi.mocked(mockTxUpdate).mock.results[0]?.value?.set;
            expect(setCall).toBeDefined();
            expect(setCall).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'canceled', canceledAt: expect.any(Date) })
            );
        });

        it('should call recalculateAddonLimitsForCustomer with correct args when recalc succeeds', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'success',
                limitKey: LIMIT_KEY,
                oldMaxValue: 10,
                newMaxValue: 10,
                addonCount: 0
            });

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            await cancelUserAddon(mockBilling, mockEntitlementService as never, cancelInput);

            // Assert: recalc was called with the correct customerId and limitKey
            expect(recalculateAddonLimitsForCustomer).toHaveBeenCalledWith(
                expect.objectContaining({
                    customerId: CUSTOMER_ID,
                    limitKey: LIMIT_KEY,
                    billing: mockBilling
                })
            );
        });
    });

    // =========================================================================
    // T-029-3: recalc fails → Sentry.captureException is called
    // =========================================================================
    describe('T-029-3: recalc fails → Sentry.captureException called', () => {
        it('should call Sentry.captureException with the recalc error when outcome=failed', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'failed',
                reason: 'QZPay service unreachable',
                limitKey: LIMIT_KEY,
                oldMaxValue: 0,
                newMaxValue: 0,
                addonCount: 0
            });

            mockDbTransaction.mockImplementation(
                async (callback: (tx: { update: typeof mockTxUpdate }) => Promise<unknown>) => {
                    return await callback({ update: mockTxUpdate });
                }
            );

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            const Sentry = await import('@sentry/node');

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            await cancelUserAddon(mockBilling, mockEntitlementService as never, cancelInput);

            // Assert: Sentry.captureException was called
            expect(Sentry.captureException).toHaveBeenCalledOnce();
            expect(Sentry.captureException).toHaveBeenCalledWith(
                expect.any(Error),
                expect.objectContaining({
                    extra: expect.objectContaining({
                        customerId: CUSTOMER_ID,
                        purchaseId: PURCHASE_ID,
                        limitKey: LIMIT_KEY
                    })
                })
            );
        });

        it('should NOT call Sentry.captureException when recalc succeeds', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'success',
                limitKey: LIMIT_KEY,
                oldMaxValue: 10,
                newMaxValue: 10,
                addonCount: 0
            });

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            const Sentry = await import('@sentry/node');

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            await cancelUserAddon(mockBilling, mockEntitlementService as never, cancelInput);

            // Assert
            expect(Sentry.captureException).not.toHaveBeenCalled();
        });
    });

    // =========================================================================
    // T-029-4: non-limit addon → direct DB update, no transaction
    // =========================================================================
    describe('T-029-4: non-limit addon → cancelAddonPurchaseRecord, no transaction', () => {
        it('should use cancelAddonPurchaseRecord (no transaction) for addons without affectsLimitKey', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(nonLimitAddonDef);

            mockSelectReturningPurchase(activeNonLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            const result = await cancelUserAddon(
                mockBilling,
                mockEntitlementService as never,
                cancelInput
            );

            // Assert: success, transaction NOT used, cancelAddonPurchaseRecord from service-core used
            expect(result.success).toBe(true);
            expect(mockDbTransaction).not.toHaveBeenCalled();
            expect(mockCancelAddonPurchaseRecord).toHaveBeenCalledWith({
                purchaseId: PURCHASE_ID
            });
        });
    });

    // =========================================================================
    // T-029-5: recalc outcome='skipped' → treated as success (no rollback)
    // =========================================================================
    describe('T-029-5: recalc outcome=skipped → no rollback, returns success', () => {
        it('should return success when recalc returns outcome=skipped (unlimited plan)', async () => {
            // Arrange
            const { getAddonBySlug } = await import('@repo/billing');
            (getAddonBySlug as unknown as MockInstance).mockReturnValue(limitAddonDef);

            const { recalculateAddonLimitsForCustomer } = await import(
                '../../src/services/addon-limit-recalculation.service'
            );
            (recalculateAddonLimitsForCustomer as unknown as MockInstance).mockResolvedValue({
                outcome: 'skipped',
                reason: 'Base plan has unlimited for this limitKey',
                limitKey: LIMIT_KEY,
                oldMaxValue: -1,
                newMaxValue: -1,
                addonCount: 1
            });

            mockSelectReturningPurchase(activeLimitAddonPurchase);

            // Act
            const { cancelUserAddon } = await import('../../src/services/addon.user-addons');
            const result = await cancelUserAddon(
                mockBilling,
                mockEntitlementService as never,
                cancelInput
            );

            // Assert: skipped is not a failure — cancel proceeds normally
            expect(result.success).toBe(true);
            expect(mockDbTransaction).toHaveBeenCalledOnce();
        });
    });
});
