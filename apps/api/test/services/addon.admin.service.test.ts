/**
 * AdminAddonService — activateAddon Test Suite
 *
 * Covers:
 * - T-038: DB writes are wrapped in withTransaction
 * - T-038: needsEntitlementSync=true is set when QZPay entitlement grant fails
 * - T-038: needsEntitlementSync=false is cleared on successful activation
 * - Standard validation: NOT_FOUND, INVALID_STATUS guards
 *
 * @module test/services/addon.admin.service.test
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks — must precede all imports ──────────────────────────────────

vi.mock('@repo/db', () => ({
    getDb: vi.fn(),
    withTransaction: vi.fn(),
    // Table schema stubs — used directly by addon.admin.ts via @repo/db imports
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        addonId: 'addon_id',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        metadata: 'metadata',
        needsEntitlementSync: 'needs_entitlement_sync',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    billingCustomers: {
        id: 'id',
        email: 'email',
        name: 'name'
    },
    safeIlike: vi.fn((_col: unknown, _term: string) => ({ __safeIlike: true }))
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        addonId: 'addon_id',
        status: 'status',
        purchasedAt: 'purchased_at',
        expiresAt: 'expires_at',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        paymentId: 'payment_id',
        limitAdjustments: 'limit_adjustments',
        entitlementAdjustments: 'entitlement_adjustments',
        metadata: 'metadata',
        needsEntitlementSync: 'needs_entitlement_sync',
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    billingCustomers: {
        id: 'id',
        email: 'email',
        name: 'name'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ type: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
    desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
    count: vi.fn(() => ({ type: 'count' })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        type: 'sql',
        strings,
        values
    }))
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn()
}));

vi.mock('../../src/services/addon-entitlement.service');

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

// ─── Imports — after mocks ─────────────────────────────────────────────────────

import * as billingModule from '@repo/billing';
import { type DrizzleClient, getDb, withTransaction } from '@repo/db';
import { AddonEntitlementService } from '../../src/services/addon-entitlement.service';
import { AdminAddonService } from '../../src/services/addon.admin';

// ─── Typed mock references ────────────────────────────────────────────────────

const mockGetDb = vi.mocked(getDb);
const mockWithTransaction = vi.mocked(withTransaction);
const mockGetAddonBySlug = vi.mocked(billingModule.getAddonBySlug);

/** Shape of the Drizzle query builder chain used in this service */
interface MockDbChain {
    select: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
}

/** Minimal addon purchase row returned by the DB select */
interface MockPurchaseRow {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    addonSlug: string;
    addonId: string | null;
    status: string;
    purchasedAt: Date;
    expiresAt: Date | null;
    canceledAt: Date | null;
    deletedAt: Date | null;
    paymentId: string | null;
    limitAdjustments: unknown;
    entitlementAdjustments: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
}

/** Optional overrides for building a mock purchase row */
type MockPurchaseOverrides = Partial<MockPurchaseRow>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockPurchase(overrides: MockPurchaseOverrides = {}): MockPurchaseRow {
    return {
        id: 'purchase-uuid-001',
        customerId: 'customer-uuid-001',
        subscriptionId: 'sub-uuid-001',
        addonSlug: 'extra-accommodations',
        addonId: null,
        status: 'expired',
        purchasedAt: new Date('2025-01-01'),
        expiresAt: new Date('2025-06-01'),
        canceledAt: null,
        deletedAt: null,
        paymentId: null,
        limitAdjustments: [],
        entitlementAdjustments: [],
        metadata: {},
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01'),
        ...overrides
    };
}

/**
 * Builds a mock DB chain whose `where` method resolves to `rows` for the
 * initial purchase lookup (select chain).
 */
function buildMockDbChain(selectRows: MockPurchaseRow[]): MockDbChain {
    const mockOffset = vi.fn().mockResolvedValue(selectRows);
    const mockOrderBy = vi.fn(() => ({ limit: mockLimit, offset: mockOffset }));
    const mockLimit = vi.fn(() => ({ offset: mockOffset }));
    const mockWhere = vi.fn(() => ({ limit: mockLimit, orderBy: mockOrderBy }));
    const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
    const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin, where: mockWhere }));
    const mockSelect = vi.fn(() => ({ from: mockFrom }));
    const mockUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
    const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

    return {
        select: mockSelect,
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        orderBy: mockOrderBy,
        limit: mockLimit,
        offset: mockOffset,
        update: mockUpdate,
        set: mockUpdateSet
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AdminAddonService.activateAddon', () => {
    let service: AdminAddonService;
    let mockEntitlementInstance: { applyAddonEntitlements: ReturnType<typeof vi.fn> };

    const purchaseId = 'purchase-uuid-001';

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AdminAddonService();

        // Default: no duration on the addon (no expiresAt calculation needed)
        mockGetAddonBySlug.mockReturnValue(undefined);

        // Default: withTransaction executes the callback immediately with a mock tx
        // The tx must provide both execute() (for SELECT FOR UPDATE) and update()
        // (for the transactional status UPDATE). execute() returns empty rows by
        // default; individual tests override this to return specific purchase rows.
        mockWithTransaction.mockImplementation(
            async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                const fakeTx = {
                    execute: vi.fn().mockResolvedValue({ rows: [] }),
                    update: vi.fn(() => ({
                        set: vi.fn(() => ({ where: vi.fn().mockResolvedValue({ rowCount: 1 }) }))
                    }))
                } as unknown as DrizzleClient;
                return callback(fakeTx);
            }
        );

        // Entitlement service mock
        mockEntitlementInstance = { applyAddonEntitlements: vi.fn().mockResolvedValue(undefined) };
        vi.mocked(AddonEntitlementService).mockImplementation(
            () => mockEntitlementInstance as unknown as AddonEntitlementService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // NOT_FOUND
    // =========================================================================

    describe('when the purchase does not exist', () => {
        it('should return NOT_FOUND error', async () => {
            // Arrange
            const chain = buildMockDbChain([]);
            // select().from().where().limit() resolves to []
            chain.limit.mockResolvedValue([]);
            mockGetDb.mockReturnValue(chain as unknown as ReturnType<typeof getDb>);

            // Act
            const result = await service.activateAddon({ purchaseId });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('NOT_FOUND');
            }
        });
    });

    // =========================================================================
    // INVALID_STATUS
    // =========================================================================

    describe('when the purchase is already active', () => {
        it('should return INVALID_STATUS error', async () => {
            // Arrange — the SELECT FOR UPDATE (inside withTransaction) returns an active purchase
            const purchase = createMockPurchase({ status: 'active' });
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // Act
            const result = await service.activateAddon({ purchaseId });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_STATUS');
                expect(result.error.message).toContain('already active');
            }
        });
    });

    describe('when the purchase has a non-activatable status', () => {
        it('should return INVALID_STATUS error for pending status', async () => {
            // Arrange — the SELECT FOR UPDATE (inside withTransaction) returns a pending purchase
            const purchase = createMockPurchase({ status: 'pending' });
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // Act
            const result = await service.activateAddon({ purchaseId });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_STATUS');
                expect(result.error.message).toContain("'pending'");
            }
        });
    });

    // =========================================================================
    // T-038: withTransaction wrapping
    // =========================================================================

    describe('DB transaction wrapping', () => {
        it('should call withTransaction for the DB update', async () => {
            // Arrange — source uses tx.execute(SELECT FOR UPDATE) inside withTransaction,
            // then tx.update(...).set(...).where(...) for the status change.
            const purchase = createMockPurchase({ status: 'expired' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: 'Owner Name'
            };

            // Override withTransaction to simulate execute returning the locked purchase
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // getAddonPurchaseById uses getDb().select() after the transaction completes
            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));
            const fakeDb = { select: mockSelect, update: vi.fn() };
            mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

            // Act
            await service.activateAddon({ purchaseId });

            // Assert: withTransaction was invoked (wraps the SELECT FOR UPDATE + UPDATE)
            expect(mockWithTransaction).toHaveBeenCalledOnce();
        });

        it('should pass the outer tx to withTransaction when provided', async () => {
            // Arrange — when input.tx is provided, it is passed as the second arg to withTransaction.
            const purchase = createMockPurchase({ status: 'canceled' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: null
            };

            // Override withTransaction to simulate the SELECT FOR UPDATE
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // getAddonPurchaseById uses getDb().select() after the transaction
            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));
            const mockUpdate = vi.fn(() => ({
                set: vi.fn(() => ({ where: vi.fn().mockResolvedValue({ rowCount: 1 }) }))
            }));

            const outerTx = {
                select: mockSelect,
                update: mockUpdate
            } as unknown as ReturnType<typeof getDb>;

            mockGetDb.mockReturnValue(outerTx);

            // Act
            await service.activateAddon({ purchaseId, tx: outerTx });

            // Assert: withTransaction received the outer tx as second argument
            expect(mockWithTransaction).toHaveBeenCalledWith(expect.any(Function), outerTx);
        });
    });

    // =========================================================================
    // T-038: needsEntitlementSync flag on QZPay failure
    // =========================================================================

    describe('when QZPay entitlement grant fails', () => {
        it('should set needsEntitlementSync=true on the purchase record (best-effort UPDATE)', async () => {
            // Arrange — tx.execute() returns the locked purchase; tx.update() handles the
            // transactional status update. After the tx, getDb().update() handles the flag SET.
            const purchase = createMockPurchase({ status: 'expired' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: null
            };

            // Override withTransaction to use execute for the SELECT FOR UPDATE
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // Track UPDATE calls from getDb() — both the flag UPDATE and getAddonPurchaseById select
            const updateCalls: Array<{ set: Record<string, unknown> }> = [];
            const mockUpdate = vi.fn(() => {
                const mockUpdateSet = vi.fn((payload: Record<string, unknown>) => {
                    updateCalls.push({ set: payload });
                    return { where: vi.fn().mockResolvedValue({ rowCount: 1 }) };
                });
                return { set: mockUpdateSet };
            });

            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));

            const fakeDb = { select: mockSelect, update: mockUpdate };
            mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

            // QZPay entitlement grant throws
            mockEntitlementInstance.applyAddonEntitlements.mockRejectedValue(
                new Error('QZPay connection timeout')
            );

            // Act
            await service.activateAddon({ purchaseId });

            // Assert: a getDb() UPDATE call sets needsEntitlementSync=true
            const flagUpdate = updateCalls.find((call) => call.set.needsEntitlementSync === true);
            expect(flagUpdate).toBeDefined();
        });

        it('should still return a successful result even if QZPay throws', async () => {
            // Arrange — execute returns purchase; after QZPay fails we still return success
            const purchase = createMockPurchase({ status: 'expired' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: null
            };

            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            const mockUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 1 });
            const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
            const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));

            const fakeDb = { select: mockSelect, update: mockUpdate };
            mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

            // QZPay fails
            mockEntitlementInstance.applyAddonEntitlements.mockRejectedValue(
                new Error('QZPay unavailable')
            );

            // Act
            const result = await service.activateAddon({ purchaseId });

            // Assert: activation is not rolled back — we still get a success result
            expect(result.success).toBe(true);
        });

        it('should not propagate errors from the needsEntitlementSync flag UPDATE', async () => {
            // Arrange — flag-setting UPDATE throws; must not propagate
            const purchase = createMockPurchase({ status: 'expired' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: null
            };

            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn(() => ({
                                where: vi.fn().mockResolvedValue({ rowCount: 1 })
                            }))
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // The flag-setting UPDATE from getDb() throws
            let updateCallCount = 0;
            const mockUpdate = vi.fn(() => {
                updateCallCount++;
                const mockUpdateWhere = vi.fn().mockImplementation(() => {
                    if (updateCallCount >= 1) {
                        return Promise.reject(new Error('Flag update failed'));
                    }
                    return Promise.resolve({ rowCount: 1 });
                });
                return { set: vi.fn(() => ({ where: mockUpdateWhere })) };
            });

            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));

            const fakeDb = { select: mockSelect, update: mockUpdate };
            mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

            // QZPay fails
            mockEntitlementInstance.applyAddonEntitlements.mockRejectedValue(
                new Error('QZPay timeout')
            );

            // Act — must not throw despite double failure
            await expect(service.activateAddon({ purchaseId })).resolves.toBeDefined();
        });
    });

    // =========================================================================
    // T-038: needsEntitlementSync cleared on successful activation
    // =========================================================================

    describe('when QZPay entitlement grant succeeds', () => {
        it('should include needsEntitlementSync=false in the transaction UPDATE', async () => {
            // Arrange — the source performs SELECT FOR UPDATE via tx.execute(), then
            // updates status via tx.update().set(). We capture what gets passed to .set().
            const purchase = createMockPurchase({ status: 'expired' });
            const fullRow = {
                ...purchase,
                status: 'active',
                customerEmail: 'owner@example.com',
                customerName: null
            };

            // Capture what gets passed to .set() inside the transaction
            const captured = { setPayload: null as { needsEntitlementSync?: boolean } | null };

            // Override withTransaction to provide execute (SELECT FOR UPDATE) and capture UPDATE SET
            mockWithTransaction.mockImplementation(
                async (callback: (tx: DrizzleClient) => Promise<unknown>) => {
                    const fakeTx = {
                        execute: vi.fn().mockResolvedValue({ rows: [purchase] }),
                        update: vi.fn(() => ({
                            set: vi.fn((payload: Record<string, unknown>) => {
                                captured.setPayload = payload as { needsEntitlementSync?: boolean };
                                return { where: vi.fn().mockResolvedValue({ rowCount: 1 }) };
                            })
                        }))
                    } as unknown as DrizzleClient;
                    return callback(fakeTx);
                }
            );

            // getAddonPurchaseById uses getDb().select() after the transaction
            const mockLimit = vi.fn().mockResolvedValue([fullRow]);
            const mockWhere = vi.fn(() => ({ limit: mockLimit }));
            const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
            const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
            const mockSelect = vi.fn(() => ({ from: mockFrom }));

            const fakeDb = { select: mockSelect, update: vi.fn() };
            mockGetDb.mockReturnValue(fakeDb as unknown as ReturnType<typeof getDb>);

            // QZPay succeeds
            mockEntitlementInstance.applyAddonEntitlements.mockResolvedValue(undefined);

            // Act
            await service.activateAddon({ purchaseId });

            // Assert: the transactional SET includes needsEntitlementSync=false
            expect(captured.setPayload).not.toBeNull();
            expect(captured.setPayload?.needsEntitlementSync).toBe(false);
        });
    });
});
