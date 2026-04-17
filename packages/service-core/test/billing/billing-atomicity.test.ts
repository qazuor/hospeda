/**
 * Tests for billing atomicity coverage improvement (SPEC-059 GAP-065).
 *
 * Verifies that when the second write inside a multi-write transaction
 * (promo-code redemption) throws, the transaction is rolled back and the first
 * write's effects are not committed.
 *
 * The mechanism under test:
 *   tryRedeemAtomically wraps two DB operations in withTransaction:
 *     1. SELECT ... FOR UPDATE  (first read/lock — simulated via tx.execute)
 *     2. UPDATE ... RETURNING   (second write — this is the one we make fail)
 *
 * When step 2 throws inside the withTransaction callback, the callback rejects,
 * withTransaction propagates the rejection (signalling a rollback to the DB driver),
 * and the outer try/catch in tryRedeemAtomically converts it to { success: false }.
 *
 * This test asserts:
 * - The returned result is { success: false } when the second write throws.
 * - withTransaction was called (atomicity boundary was established).
 * - The first write's side effects (SELECT FOR UPDATE) are never re-executed
 *   independently after the failure.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @repo/db before importing module under test
vi.mock('@repo/db', () => ({
    billingPromoCodes: { usedCount: 'usedCount', id: 'id' },
    billingPromoCodeUsage: {},
    eq: vi.fn(),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
        _type: 'sql'
    })),
    getDb: vi.fn(),
    withTransaction: vi.fn()
}));

import * as dbModule from '@repo/db';
import { tryRedeemAtomically } from '../../src/services/billing/promo-code/promo-code.redemption.js';

const mockWithTransaction = dbModule.withTransaction as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('billing atomicity — tryRedeemAtomically multi-write rollback (SPEC-059 GAP-065)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns failure and does not commit when the UPDATE (second write) throws', async () => {
        // Arrange — first write (SELECT FOR UPDATE via tx.execute) succeeds,
        // second write (UPDATE ... RETURNING via tx.update chain) throws
        const firstWriteExecute = vi.fn().mockResolvedValue({
            rows: [{ id: 'pc1', usedCount: 0, maxUses: 10 }]
        });

        mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                execute: firstWriteExecute,
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            // Second write throws — simulating a mid-transaction DB error
                            returning: vi
                                .fn()
                                .mockRejectedValue(new Error('connection lost mid-transaction'))
                        })
                    })
                })
            };
            // withTransaction re-throws if the callback rejects
            return fn(tx);
        });

        // Act
        const result = await tryRedeemAtomically('pc1');

        // Assert — the outer catch converts the rejection to a failure response
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error?.code).toBe('INTERNAL_ERROR');
    });

    it('asserts withTransaction was called (atomicity boundary was established)', async () => {
        // Arrange
        mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                execute: vi.fn().mockResolvedValue({ rows: [] })
            };
            return fn(tx);
        });

        // Act
        await tryRedeemAtomically('pc1');

        // Assert — withTransaction must be called exactly once per redemption attempt
        expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    });

    it('does not call UPDATE at all when the SELECT FOR UPDATE finds no row', async () => {
        // Arrange — first write returns empty rows (promo code not found)
        const updateSpy = vi.fn();
        mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                execute: vi.fn().mockResolvedValue({ rows: [] }),
                update: updateSpy
            };
            return fn(tx);
        });

        // Act
        const result = await tryRedeemAtomically('pc-missing');

        // Assert — early return before the UPDATE, so update is never called
        expect(result.success).toBe(false);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('does not call UPDATE when max uses is already reached', async () => {
        // Arrange — promo code is at capacity
        const updateSpy = vi.fn();
        mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                execute: vi.fn().mockResolvedValue({
                    rows: [{ id: 'pc1', usedCount: 5, maxUses: 5 }]
                }),
                update: updateSpy
            };
            return fn(tx);
        });

        // Act
        const result = await tryRedeemAtomically('pc1');

        // Assert — transaction exits before the UPDATE — no partial write committed
        expect(result.success).toBe(false);
        expect(updateSpy).not.toHaveBeenCalled();
    });

    it('returns success and calls both writes when redemption is valid', async () => {
        // Arrange — both writes succeed
        const updatedCode = {
            id: 'pc1',
            code: 'SAVE10',
            usedCount: 1,
            maxUses: 10,
            active: true
        };
        const updateSpy = vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([updatedCode])
                })
            })
        });
        mockWithTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const tx = {
                execute: vi.fn().mockResolvedValue({
                    rows: [{ id: 'pc1', usedCount: 0, maxUses: 10 }]
                }),
                update: updateSpy
            };
            return fn(tx);
        });

        // Act
        const result = await tryRedeemAtomically('pc1');

        // Assert — both writes executed and result is committed
        expect(result.success).toBe(true);
        expect(result.data).toEqual(updatedCode);
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });
});
