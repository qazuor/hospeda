/**
 * Unit tests for addon-user-addons.ts
 *
 * Verifies that:
 * - `queryUserAddons` routes DB access through `ctx.tx` when provided, and
 *   falls back to `getDb()` when omitted.
 * - `queryActiveAddonPurchases` routes through `ctx.tx` or falls back to `getDb()`.
 * - `cancelAddonPurchaseRecord` routes through `ctx.tx` or falls back to `getDb()`.
 * - `queryAddonActive` propagates `ctx` to the inner `queryUserAddons` call so
 *   that the same db handle is used end-to-end.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks must be declared before the module under test is imported ──────────

const { mockGetDb } = vi.hoisted(() => ({
    mockGetDb: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb
}));

vi.mock('@repo/db/schemas', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customerId',
        addonSlug: 'addonSlug',
        status: 'status',
        purchasedAt: 'purchasedAt',
        expiresAt: 'expiresAt',
        canceledAt: 'canceledAt',
        deletedAt: 'deletedAt',
        updatedAt: 'updatedAt',
        limitAdjustments: 'limitAdjustments',
        entitlementAdjustments: 'entitlementAdjustments'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true }))
}));

vi.mock('@repo/billing', () => ({
    getAddonBySlug: vi.fn((_slug: string) => null)
}));

import {
    cancelAddonPurchaseRecord,
    queryActiveAddonPurchases,
    queryAddonActive,
    queryUserAddons
} from '../../src/services/billing/addon/addon-user-addons.js';

// ─── Helper builders ──────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Drizzle client with select() -> from() -> where() chain.
 */
function buildSelectMockTx(rows: unknown[] = []) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(rows)
            })
        })
    };
}

/**
 * Builds a minimal mock Drizzle client with update() -> set() -> where() chain.
 */
function buildUpdateMockTx(rowCount = 1) {
    return {
        update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue({ rowCount })
            })
        })
    };
}

/**
 * Builds a minimal billing client stub.
 */
function buildBillingClient(customerId: string | null = 'cust-1') {
    return {
        customers: {
            getByExternalId: vi
                .fn()
                .mockResolvedValue(
                    customerId !== null ? { id: customerId, email: 'test@example.com' } : null
                )
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([])
        }
    };
}

// ─── queryUserAddons ──────────────────────────────────────────────────────────

describe('queryUserAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx routing', () => {
        it('should use ctx.tx when a query context with tx is provided', async () => {
            // Arrange
            const mockTx = buildSelectMockTx([]);
            const billing = buildBillingClient('cust-1');
            const ctx = { tx: mockTx as never };

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-1', ctx });

            // Assert — ctx.tx was used, getDb() was NOT called
            expect(result.success).toBe(true);
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-1' });

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(mockDb.select).toHaveBeenCalledOnce();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');
            const ctx = {}; // tx is undefined

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-1', ctx });

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('early return when customer not found', () => {
        it('should return empty list without hitting the database', async () => {
            // Arrange
            const billing = buildBillingClient(null); // no customer

            // Act
            const result = await queryUserAddons({ billing, userId: 'unknown-user' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    describe('successful query', () => {
        it('should return an empty list when no active addon purchases exist', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-1' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });

        it('should map raw purchase rows to UserAddon objects', async () => {
            // Arrange
            const rawRow = {
                id: 'purchase-1',
                customerId: 'cust-1',
                addonSlug: 'extra-photos',
                status: 'active',
                purchasedAt: new Date('2025-01-01'),
                expiresAt: null,
                canceledAt: null,
                deletedAt: null,
                limitAdjustments: null,
                entitlementAdjustments: null
            };
            const mockDb = buildSelectMockTx([rawRow]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryUserAddons({ billing, userId: 'user-1' });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                expect(result.data[0]?.id).toBe('purchase-1');
                expect(result.data[0]?.addonSlug).toBe('extra-photos');
                expect(result.data[0]?.status).toBe('active');
            }
        });
    });
});

// ─── queryActiveAddonPurchases ────────────────────────────────────────────────

describe('queryActiveAddonPurchases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx routing', () => {
        it('should use ctx.tx when a query context with tx is provided', async () => {
            // Arrange
            const mockTx = buildSelectMockTx([]);
            const ctx = { tx: mockTx as never };

            // Act
            const result = await queryActiveAddonPurchases({
                customerId: 'cust-1',
                ctx
            });

            // Assert — ctx.tx was used, getDb() was NOT called
            expect(Array.isArray(result)).toBe(true);
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await queryActiveAddonPurchases({ customerId: 'cust-1' });

            // Assert
            expect(Array.isArray(result)).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(mockDb.select).toHaveBeenCalledOnce();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const ctx = {}; // tx is undefined

            // Act
            const result = await queryActiveAddonPurchases({ customerId: 'cust-1', ctx });

            // Assert
            expect(Array.isArray(result)).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('successful query', () => {
        it('should return an empty array when no active purchases exist', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await queryActiveAddonPurchases({ customerId: 'cust-1' });

            // Assert
            expect(result).toHaveLength(0);
        });

        it('should return purchase id and addonSlug fields', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([
                { id: 'purchase-1', addonSlug: 'extra-listings' },
                { id: 'purchase-2', addonSlug: 'priority-support' }
            ]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await queryActiveAddonPurchases({ customerId: 'cust-1' });

            // Assert
            expect(result).toHaveLength(2);
            expect(result[0]?.id).toBe('purchase-1');
            expect(result[0]?.addonSlug).toBe('extra-listings');
            expect(result[1]?.id).toBe('purchase-2');
        });
    });
});

// ─── cancelAddonPurchaseRecord ────────────────────────────────────────────────

describe('cancelAddonPurchaseRecord', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx routing', () => {
        it('should use ctx.tx when a query context with tx is provided', async () => {
            // Arrange
            const mockTx = buildUpdateMockTx(1);
            const ctx = { tx: mockTx as never };

            // Act
            const rowCount = await cancelAddonPurchaseRecord({
                purchaseId: 'purchase-1',
                ctx
            });

            // Assert — ctx.tx was used, getDb() was NOT called
            expect(rowCount).toBe(1);
            expect(mockTx.update).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildUpdateMockTx(1);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const rowCount = await cancelAddonPurchaseRecord({ purchaseId: 'purchase-1' });

            // Assert
            expect(rowCount).toBe(1);
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(mockDb.update).toHaveBeenCalledOnce();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            const mockDb = buildUpdateMockTx(1);
            mockGetDb.mockReturnValue(mockDb);
            const ctx = {}; // tx is undefined

            // Act
            const rowCount = await cancelAddonPurchaseRecord({
                purchaseId: 'purchase-1',
                ctx
            });

            // Assert
            expect(rowCount).toBe(1);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('return value', () => {
        it('should return 1 when one row is updated', async () => {
            // Arrange
            const mockDb = buildUpdateMockTx(1);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const rowCount = await cancelAddonPurchaseRecord({ purchaseId: 'purchase-1' });

            // Assert
            expect(rowCount).toBe(1);
        });

        it('should return 0 when no rows are updated (already canceled or not found)', async () => {
            // Arrange
            const mockDb = buildUpdateMockTx(0);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const rowCount = await cancelAddonPurchaseRecord({
                purchaseId: 'nonexistent-purchase'
            });

            // Assert
            expect(rowCount).toBe(0);
        });

        it('should return 0 when rowCount is undefined in the driver response', async () => {
            // Arrange — some Drizzle drivers omit rowCount
            const mockDb = {
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockResolvedValue({})
                    })
                })
            };
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const rowCount = await cancelAddonPurchaseRecord({ purchaseId: 'purchase-1' });

            // Assert
            expect(rowCount).toBe(0);
        });
    });
});

// ─── queryAddonActive — ctx propagation ───────────────────────────────────────

describe('queryAddonActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx propagation to queryUserAddons', () => {
        it('should use ctx.tx (not getDb) when ctx is propagated to inner queryUserAddons', async () => {
            // Arrange — ctx.tx is the only db handle; if propagation works, getDb() is never called
            const mockTx = buildSelectMockTx([]);
            const billing = buildBillingClient('cust-1');
            const ctx = { tx: mockTx as never };

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'user-1',
                addonSlug: 'extra-photos',
                ctx
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'user-1',
                addonSlug: 'extra-photos'
            });

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('addon presence logic', () => {
        it('should return false when user has no active addons', async () => {
            // Arrange
            const mockDb = buildSelectMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'user-1',
                addonSlug: 'extra-photos'
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(false);
            }
        });

        it('should return true when the target addon is present and active', async () => {
            // Arrange
            const rawRow = {
                id: 'purchase-1',
                customerId: 'cust-1',
                addonSlug: 'extra-photos',
                status: 'active',
                purchasedAt: new Date('2025-01-01'),
                expiresAt: null,
                canceledAt: null,
                deletedAt: null,
                limitAdjustments: null,
                entitlementAdjustments: null
            };
            const mockDb = buildSelectMockTx([rawRow]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'user-1',
                addonSlug: 'extra-photos'
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(true);
            }
        });

        it('should return false when a different addon is present but not the target one', async () => {
            // Arrange
            const rawRow = {
                id: 'purchase-1',
                customerId: 'cust-1',
                addonSlug: 'priority-support', // different slug
                status: 'active',
                purchasedAt: new Date('2025-01-01'),
                expiresAt: null,
                canceledAt: null,
                deletedAt: null,
                limitAdjustments: null,
                entitlementAdjustments: null
            };
            const mockDb = buildSelectMockTx([rawRow]);
            mockGetDb.mockReturnValue(mockDb);
            const billing = buildBillingClient('cust-1');

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'user-1',
                addonSlug: 'extra-photos' // looking for a different slug
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(false);
            }
        });

        it('should return false when customer does not exist', async () => {
            // Arrange — billing returns null customer
            const billing = buildBillingClient(null);

            // Act
            const result = await queryAddonActive({
                billing,
                userId: 'unknown-user',
                addonSlug: 'extra-photos'
            });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBe(false);
            }
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });
});
