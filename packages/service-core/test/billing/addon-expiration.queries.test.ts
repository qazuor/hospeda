/**
 * Unit tests for addon-expiration.queries.ts
 *
 * Verifies that:
 * - `findExpiredAddons` and `findExpiringAddons` route through `ctx.tx` when a
 *   query context is provided.
 * - Both functions fall back to `getDb()` when called without `ctx` (backward
 *   compatibility).
 * - Validation and error handling behave correctly independently of ctx.
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
        status: 'status',
        expiresAt: 'expiresAt',
        deletedAt: 'deletedAt'
    }
}));

vi.mock('drizzle-orm', () => ({
    and: vi.fn((...args: unknown[]) => args),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    gte: vi.fn((col: unknown, val: unknown) => ({ col, val, op: 'gte' })),
    isNotNull: vi.fn((col: unknown) => ({ col, isNotNull: true })),
    isNull: vi.fn((col: unknown) => ({ col, isNull: true })),
    lte: vi.fn((col: unknown, val: unknown) => ({ col, val, op: 'lte' }))
}));

import {
    findExpiredAddons,
    findExpiringAddons
} from '../../src/services/billing/addon/addon-expiration.queries.js';

// ─── Helper builders ──────────────────────────────────────────────────────────

/**
 * Builds a minimal mock Drizzle client that resolves `select().from().where()`
 * with the given rows.
 */
function buildMockTx(rows: unknown[] = []) {
    return {
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(rows)
            })
        })
    };
}

// ─── findExpiredAddons ────────────────────────────────────────────────────────

describe('findExpiredAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx routing', () => {
        it('should use ctx.tx when a query context with tx is provided', async () => {
            // Arrange
            const mockTx = buildMockTx([]);
            const ctx = { tx: mockTx as never };

            // Act
            const result = await findExpiredAddons(ctx);

            // Assert — ctx.tx was used, getDb() was NOT called
            expect(result.success).toBe(true);
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await findExpiredAddons();

            // Assert — getDb() was called, not ctx.tx
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(mockDb.select).toHaveBeenCalledOnce();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const ctx = {}; // tx is undefined

            // Act
            const result = await findExpiredAddons(ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('successful query', () => {
        it('should return an empty list when no expired addons are found', async () => {
            // Arrange
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });

        it('should map raw rows to ExpiredAddon shape with parsed JSONB fields', async () => {
            // Arrange
            const past = new Date(Date.now() - 86_400_000);
            const rawRow = {
                id: 'purchase-1',
                customerId: 'cust-1',
                subscriptionId: 'sub-1',
                addonSlug: 'extra-listings',
                purchasedAt: new Date('2025-01-01'),
                expiresAt: past,
                deletedAt: null,
                limitAdjustments: [
                    {
                        limitKey: 'max_accommodations',
                        increase: 10,
                        previousValue: 5,
                        newValue: 15
                    }
                ],
                entitlementAdjustments: [{ entitlementKey: 'featured_listing', granted: true }]
            };
            const mockDb = buildMockTx([rawRow]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await findExpiredAddons();

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                const addon = result.data[0];
                expect(addon?.id).toBe('purchase-1');
                expect(addon?.customerId).toBe('cust-1');
                expect(addon?.addonSlug).toBe('extra-listings');
                expect(addon?.limitAdjustments).toHaveLength(1);
                expect(addon?.limitAdjustments[0]?.limitKey).toBe('max_accommodations');
                expect(addon?.entitlementAdjustments).toHaveLength(1);
                expect(addon?.entitlementAdjustments[0]?.entitlementKey).toBe('featured_listing');
            }
        });
    });

    describe('error handling', () => {
        it('should return a failure result when the database throws', async () => {
            // Arrange
            const failingDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('db connection lost'))
                    })
                })
            };
            mockGetDb.mockReturnValue(failingDb);

            // Act
            const result = await findExpiredAddons();

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toMatch(/db connection lost/);
            }
        });

        it('should return a failure result when ctx.tx throws', async () => {
            // Arrange
            const failingTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('tx rolled back'))
                    })
                })
            };
            const ctx = { tx: failingTx as never };

            // Act
            const result = await findExpiredAddons(ctx);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toMatch(/tx rolled back/);
            }
        });
    });
});

// ─── findExpiringAddons ───────────────────────────────────────────────────────

describe('findExpiringAddons', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ctx routing', () => {
        it('should use ctx.tx when a query context with tx is provided', async () => {
            // Arrange
            const mockTx = buildMockTx([]);
            const ctx = { tx: mockTx as never };

            // Act
            const result = await findExpiringAddons({ daysAhead: 7 }, ctx);

            // Assert — ctx.tx was used, getDb() was NOT called
            expect(result.success).toBe(true);
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to getDb() when called without ctx', async () => {
            // Arrange
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await findExpiringAddons({ daysAhead: 7 });

            // Assert — getDb() was called
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(mockDb.select).toHaveBeenCalledOnce();
        });

        it('should fall back to getDb() when ctx has no tx property', async () => {
            // Arrange
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);
            const ctx = {};

            // Act
            const result = await findExpiringAddons({ daysAhead: 3 }, ctx);

            // Assert
            expect(result.success).toBe(true);
            expect(mockGetDb).toHaveBeenCalledOnce();
        });
    });

    describe('input validation', () => {
        it('should return INVALID_INPUT when daysAhead is 0', async () => {
            // Act
            const result = await findExpiringAddons({ daysAhead: 0 });

            // Assert — validation runs before any db call
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_INPUT');
            }
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should return INVALID_INPUT when daysAhead is negative', async () => {
            const result = await findExpiringAddons({ daysAhead: -1 });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_INPUT');
            }
        });

        it('should return INVALID_INPUT when daysAhead exceeds 365', async () => {
            const result = await findExpiringAddons({ daysAhead: 366 });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_INPUT');
            }
        });

        it('should return INVALID_INPUT when daysAhead is a float', async () => {
            const result = await findExpiringAddons({ daysAhead: 1.5 });

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INVALID_INPUT');
            }
        });

        it('should accept daysAhead = 1 (boundary)', async () => {
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            const result = await findExpiringAddons({ daysAhead: 1 });

            expect(result.success).toBe(true);
        });

        it('should accept daysAhead = 365 (boundary)', async () => {
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            const result = await findExpiringAddons({ daysAhead: 365 });

            expect(result.success).toBe(true);
        });
    });

    describe('successful query', () => {
        it('should return an empty list when no expiring addons are found', async () => {
            const mockDb = buildMockTx([]);
            mockGetDb.mockReturnValue(mockDb);

            const result = await findExpiringAddons({ daysAhead: 7 });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(0);
            }
        });

        it('should compute daysUntilExpiration and map rows to ExpiringAddon shape', async () => {
            // Arrange
            const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // ~3 days ahead
            const rawRow = {
                id: 'purchase-2',
                customerId: 'cust-2',
                subscriptionId: null,
                addonSlug: 'priority-support',
                purchasedAt: new Date('2025-03-01'),
                expiresAt: future,
                deletedAt: null,
                limitAdjustments: null,
                entitlementAdjustments: null
            };
            const mockDb = buildMockTx([rawRow]);
            mockGetDb.mockReturnValue(mockDb);

            // Act
            const result = await findExpiringAddons({ daysAhead: 7 });

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toHaveLength(1);
                const addon = result.data[0];
                expect(addon?.id).toBe('purchase-2');
                expect(addon?.subscriptionId).toBeNull();
                expect(addon?.daysUntilExpiration).toBeGreaterThan(0);
                // JSONB null falls back to empty arrays
                expect(addon?.limitAdjustments).toEqual([]);
                expect(addon?.entitlementAdjustments).toEqual([]);
            }
        });
    });

    describe('error handling', () => {
        it('should return a failure result when the database throws', async () => {
            // Arrange
            const failingDb = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('query timeout'))
                    })
                })
            };
            mockGetDb.mockReturnValue(failingDb);

            // Act
            const result = await findExpiringAddons({ daysAhead: 7 });

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toMatch(/query timeout/);
            }
        });

        it('should return a failure result when ctx.tx throws', async () => {
            // Arrange
            const failingTx = {
                select: vi.fn().mockReturnValue({
                    from: vi.fn().mockReturnValue({
                        where: vi.fn().mockRejectedValue(new Error('deadlock detected'))
                    })
                })
            };
            const ctx = { tx: failingTx as never };

            // Act
            const result = await findExpiringAddons({ daysAhead: 14 }, ctx);

            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.code).toBe('INTERNAL_ERROR');
                expect(result.error.message).toMatch(/deadlock detected/);
            }
        });
    });
});
