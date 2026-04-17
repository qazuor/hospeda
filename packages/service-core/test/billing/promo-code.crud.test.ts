/**
 * Unit tests for promo-code.crud — ctx threading (SPEC-064, T-002).
 *
 * Covers the first 3 exported functions:
 *   - createPromoCode
 *   - getPromoCodeByCode
 *   - getPromoCodeById
 *
 * Each function is tested for:
 *   1. ctx with tx provided → queries go through ctx.tx, NOT getDb()
 *   2. No ctx provided (backward compat) → queries use getDb()
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock @repo/db before importing the module under test ────────────────────

const mockInsert = vi.fn();
const mockSelect = vi.fn();

/**
 * Creates a thenable chainable query builder stub.
 *
 * The returned object is itself a Promise (resolves to `finalValue`) AND
 * exposes all Drizzle query-builder methods. Each method returns the chain
 * so calls can be chained, and any await on the chain (or on a terminal
 * method like `.returning()` / `.offset()`) resolves to `finalValue`.
 *
 * Terminal methods that end a specific query path:
 *   - `.returning()` — INSERT / UPDATE
 *   - `.offset()` — SELECT with pagination
 *   - `.limit()` when used as terminal — SELECT without offset
 * All three resolve to `finalValue`.
 *
 * Intermediate methods (`.insert()`, `.select()`, `.from()`, `.where()`,
 * `.update()`, `.set()`, `.values()`, `.orderBy()`, `.limit()` when chained)
 * return the chain so further calls work.
 */
function makeChain(finalValue: unknown) {
    const resolved = Promise.resolve(finalValue);

    const chain = Object.assign(resolved, {
        // INSERT path
        insert: vi.fn(),
        values: vi.fn(),
        returning: vi.fn().mockResolvedValue(finalValue),

        // SELECT path
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        // limit returns chain so .offset() can be called after it
        limit: vi.fn(),
        // offset is the terminal call for paginated SELECT
        offset: vi.fn().mockResolvedValue(finalValue),

        // UPDATE path
        update: vi.fn(),
        set: vi.fn()
    });

    // All intermediate methods return the chain.
    chain.insert.mockReturnValue(chain);
    chain.values.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.orderBy.mockReturnValue(chain);
    chain.limit.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    chain.set.mockReturnValue(chain);

    return chain;
}

const mockUpdate = vi.fn();

/** Shared mock DB client returned by getDb(). */
const _mockDb = {
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate
};

vi.mock('@repo/db', () => ({
    billingPromoCodes: {
        code: 'code',
        id: 'id',
        active: 'active',
        type: 'type',
        value: 'value',
        expiresAt: 'expiresAt',
        maxUses: 'maxUses',
        usedCount: 'usedCount',
        config: 'config',
        validPlans: 'validPlans',
        newCustomersOnly: 'newCustomersOnly',
        createdAt: 'createdAt',
        livemode: 'livemode'
    },
    eq: vi.fn((col: unknown, val: unknown) => ({ _eq: { col, val } })),
    getDb: vi.fn(),
    // Unused by the 3 functions under test but required for the module to load
    and: vi.fn(),
    count: vi.fn(),
    desc: vi.fn(),
    isNull: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    safeIlike: vi.fn(),
    sql: vi.fn()
}));

import * as dbModule from '@repo/db';
import {
    createPromoCode,
    deletePromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    listPromoCodes,
    updatePromoCode
} from '../../src/services/billing/promo-code/promo-code.crud.js';

const mockGetDb = dbModule.getDb as ReturnType<typeof vi.fn>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal QZPayBillingPromoCode-like row. */
function makeDbRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'row-id-1',
        code: 'SAVE10',
        type: 'percentage',
        value: 10,
        active: true,
        expiresAt: null,
        maxUses: null,
        usedCount: 0,
        config: null,
        validPlans: null,
        newCustomersOnly: false,
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        livemode: false,
        ...overrides
    };
}

/** Build a mock tx client with chainable query methods. */
function _makeMockTx(finalValue: unknown) {
    const chain = makeChain(finalValue);
    return {
        insert: vi.fn().mockReturnValue(chain),
        select: vi.fn().mockReturnValue(chain),
        update: vi.fn().mockReturnValue(chain),
        _chain: chain
    };
}

// ── Test suite ───────────────────────────────────────────────────────────────

describe('promo-code.crud — ctx threading (first 3 functions)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── createPromoCode ────────────────────────────────────────────────────

    describe('createPromoCode', () => {
        const baseInput = {
            code: 'save10',
            discountType: 'percentage' as const,
            discountValue: 10
        };

        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const mockTx = {
                insert: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await createPromoCode(baseInput, {}, ctx);

            // Assert — ctx.tx.insert was called, getDb() was NOT
            expect(mockTx.insert).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const fakeDb = { insert: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await createPromoCode(baseInput);

            // Assert — getDb() was called, tx was not involved
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.insert).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('should prefer ctx.tx over options.tx when both are provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const ctxChain = makeChain([dbRow]);
            const ctxTx = { insert: vi.fn().mockReturnValue(ctxChain) };
            const optionsTx = { insert: vi.fn() };

            const ctx = { tx: ctxTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            await createPromoCode(
                baseInput,
                { tx: optionsTx as unknown as import('@repo/db').DrizzleClient },
                ctx
            );

            // Assert — ctx.tx wins
            expect(ctxTx.insert).toHaveBeenCalledOnce();
            expect(optionsTx.insert).not.toHaveBeenCalled();
            expect(mockGetDb).not.toHaveBeenCalled();
        });

        it('should fall back to options.tx when ctx is not provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const optionsTx = { insert: vi.fn().mockReturnValue(chain) };

            // Act
            await createPromoCode(baseInput, {
                tx: optionsTx as unknown as import('@repo/db').DrizzleClient
            });

            // Assert — options.tx is used, getDb() is NOT
            expect(optionsTx.insert).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
        });
    });

    // ── getPromoCodeByCode ─────────────────────────────────────────────────

    describe('getPromoCodeByCode', () => {
        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow({ code: 'SAVE10' });
            const chain = makeChain([dbRow]);
            const mockTx = {
                select: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await getPromoCodeByCode('save10', ctx);

            // Assert
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow({ code: 'SAVE10' });
            const chain = makeChain([dbRow]);
            const fakeDb = { select: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await getPromoCodeByCode('save10');

            // Assert
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.select).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('should return NOT_FOUND when no row matches', async () => {
            // Arrange
            const chain = makeChain([]);
            const fakeDb = { select: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await getPromoCodeByCode('NOPE');

            // Assert
            expect(result.success).toBe(false);
            expect((result as { success: false; error: { code: string } }).error.code).toBe(
                'NOT_FOUND'
            );
        });

        it('should uppercase the code before querying', async () => {
            // Arrange
            const chain = makeChain([]);
            const mockTx = { select: vi.fn().mockReturnValue(chain) };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };
            const eqMock = dbModule.eq as ReturnType<typeof vi.fn>;

            // Act
            await getPromoCodeByCode('lowercase', ctx);

            // Assert — eq was called with uppercased string
            expect(eqMock).toHaveBeenCalledWith(dbModule.billingPromoCodes.code, 'LOWERCASE');
        });
    });

    // ── updatePromoCode ────────────────────────────────────────────────────

    describe('updatePromoCode', () => {
        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const mockTx = {
                select: vi.fn().mockReturnValue(chain),
                update: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await updatePromoCode('row-id-1', { isActive: false }, ctx);

            // Assert — ctx.tx.update was called, getDb() was NOT
            expect(mockTx.update).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const fakeDb = {
                select: vi.fn().mockReturnValue(chain),
                update: vi.fn().mockReturnValue(chain)
            };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await updatePromoCode('row-id-1', { isActive: false });

            // Assert — getDb() was called, ctx.tx was not involved
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.update).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('should use ctx.tx for the pre-fetch select when description is updated', async () => {
            // Arrange
            const dbRow = makeDbRow({ config: { existing: 'value' } });
            const chain = makeChain([dbRow]);
            const mockTx = {
                select: vi.fn().mockReturnValue(chain),
                update: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await updatePromoCode(
                'row-id-1',
                { description: 'New description' },
                ctx
            );

            // Assert — select (pre-fetch) and update both went through ctx.tx
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockTx.update).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should return NOT_FOUND when row does not exist', async () => {
            // Arrange
            const chain = makeChain([]);
            const fakeDb = {
                select: vi.fn().mockReturnValue(chain),
                update: vi.fn().mockReturnValue(chain)
            };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await updatePromoCode('missing-id', { isActive: false });

            // Assert
            expect(result.success).toBe(false);
            expect((result as { success: false; error: { code: string } }).error.code).toBe(
                'NOT_FOUND'
            );
        });
    });

    // ── deletePromoCode ────────────────────────────────────────────────────

    describe('deletePromoCode', () => {
        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const mockTx = {
                update: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await deletePromoCode('row-id-1', ctx);

            // Assert — ctx.tx.update was called, getDb() was NOT
            expect(mockTx.update).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const chain = makeChain([dbRow]);
            const fakeDb = { update: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await deletePromoCode('row-id-1');

            // Assert — getDb() was called, ctx.tx was not involved
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.update).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('should return NOT_FOUND when row does not exist', async () => {
            // Arrange
            const chain = makeChain([]);
            const fakeDb = { update: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await deletePromoCode('missing-id');

            // Assert
            expect(result.success).toBe(false);
            expect((result as { success: false; error: { code: string } }).error.code).toBe(
                'NOT_FOUND'
            );
        });
    });

    // ── listPromoCodes ─────────────────────────────────────────────────────

    describe('listPromoCodes', () => {
        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow();
            // count query returns [{ value: 1 }], items query returns [dbRow]
            const countChain = makeChain([{ value: 1 }]);
            const itemsChain = makeChain([dbRow]);
            const mockTx = {
                select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(itemsChain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await listPromoCodes({}, ctx);

            // Assert — ctx.tx.select was called (twice: count + items), getDb() was NOT
            expect(mockTx.select).toHaveBeenCalledTimes(2);
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const countChain = makeChain([{ value: 1 }]);
            const itemsChain = makeChain([dbRow]);
            const fakeDb = {
                select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(itemsChain)
            };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await listPromoCodes();

            // Assert — getDb() was called, ctx.tx was not involved
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.select).toHaveBeenCalledTimes(2);
            expect(result.success).toBe(true);
        });

        it('should return correct pagination metadata', async () => {
            // Arrange
            const dbRow = makeDbRow();
            const countChain = makeChain([{ value: 42 }]);
            const itemsChain = makeChain([dbRow]);
            const fakeDb = {
                select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(itemsChain)
            };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await listPromoCodes({ page: 2, pageSize: 10 });

            // Assert
            expect(result.success).toBe(true);
            const successResult = result as {
                success: true;
                data: {
                    items: unknown[];
                    pagination: {
                        page: number;
                        pageSize: number;
                        total: number;
                        totalPages: number;
                    };
                };
            };
            expect(successResult.data.pagination.page).toBe(2);
            expect(successResult.data.pagination.pageSize).toBe(10);
            expect(successResult.data.pagination.total).toBe(42);
            expect(successResult.data.pagination.totalPages).toBe(5);
        });

        it('should return empty list when no rows match', async () => {
            // Arrange
            const countChain = makeChain([{ value: 0 }]);
            const itemsChain = makeChain([]);
            const fakeDb = {
                select: vi.fn().mockReturnValueOnce(countChain).mockReturnValueOnce(itemsChain)
            };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await listPromoCodes({ active: true });

            // Assert
            expect(result.success).toBe(true);
            const successResult = result as {
                success: true;
                data: { items: unknown[]; pagination: { total: number } };
            };
            expect(successResult.data.items).toHaveLength(0);
            expect(successResult.data.pagination.total).toBe(0);
        });
    });

    // ── getPromoCodeById ───────────────────────────────────────────────────

    describe('getPromoCodeById', () => {
        it('should use ctx.tx when ctx is provided', async () => {
            // Arrange
            const dbRow = makeDbRow({ id: 'uuid-abc' });
            const chain = makeChain([dbRow]);
            const mockTx = {
                select: vi.fn().mockReturnValue(chain)
            };
            const ctx = { tx: mockTx as unknown as import('@repo/db').DrizzleClient };

            // Act
            const result = await getPromoCodeById('uuid-abc', ctx);

            // Assert
            expect(mockTx.select).toHaveBeenCalledOnce();
            expect(mockGetDb).not.toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should use getDb() when ctx is not provided (backward compat)', async () => {
            // Arrange
            const dbRow = makeDbRow({ id: 'uuid-abc' });
            const chain = makeChain([dbRow]);
            const fakeDb = { select: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await getPromoCodeById('uuid-abc');

            // Assert
            expect(mockGetDb).toHaveBeenCalledOnce();
            expect(fakeDb.select).toHaveBeenCalledOnce();
            expect(result.success).toBe(true);
        });

        it('should return NOT_FOUND when no row matches', async () => {
            // Arrange
            const chain = makeChain([]);
            const fakeDb = { select: vi.fn().mockReturnValue(chain) };
            mockGetDb.mockReturnValue(fakeDb);

            // Act
            const result = await getPromoCodeById('uuid-missing');

            // Assert
            expect(result.success).toBe(false);
            expect((result as { success: false; error: { code: string } }).error.code).toBe(
                'NOT_FOUND'
            );
        });
    });
});
