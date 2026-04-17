/**
 * @fileoverview
 * Documents and verifies the "always new boundary" behavior of withServiceTransaction.
 *
 * When withServiceTransaction is called inside another active withServiceTransaction,
 * it does NOT join the outer transaction via savepoints. Instead, it creates a new,
 * independent transaction boundary. Rolling back the inner transaction does not affect
 * writes already committed by the outer transaction, and vice versa.
 *
 * This behavior is intentional and simplifies rollback reasoning.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/types';
import '../setupTest';

// Each call to withTransaction creates a fresh mock tx object, simulating
// the database opening a new independent transaction boundary each time.
const mockExecute = vi.fn().mockResolvedValue(undefined);

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        // A new object per call models a new, independent transaction boundary.
        const freshTx = { execute: mockExecute };
        return cb(freshTx);
    })
}));

vi.mock('drizzle-orm', () => ({
    sql: Object.assign(
        (strings: TemplateStringsArray, ..._values: unknown[]) => ({
            type: 'sql',
            strings,
            _values
        }),
        {
            raw: (value: string) => ({ type: 'sql-raw', value })
        }
    )
}));

const { withServiceTransaction } = await import('../../src/utils/transaction');

describe('withServiceTransaction — nested boundary behavior', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue(undefined);
    });

    it('creates a new independent boundary when called inside another withServiceTransaction', async () => {
        let outerTx: ServiceContext['tx'] | undefined;
        let innerTx: ServiceContext['tx'] | undefined;

        await withServiceTransaction(async (outerCtx) => {
            outerTx = outerCtx.tx;

            await withServiceTransaction(async (innerCtx) => {
                innerTx = innerCtx.tx;
            });
        });

        // Both tx references must be defined (non-null inside the callback).
        expect(outerTx).toBeDefined();
        expect(innerTx).toBeDefined();

        // The inner call receives a different transaction object than the outer call.
        // This is the observable proof that a new boundary was created rather than
        // joining the outer transaction via savepoints.
        expect(innerTx).not.toBe(outerTx);
    });

    it('outer transaction result is unaffected when only the inner call throws', async () => {
        let outerCommitted = false;

        await withServiceTransaction(async (_outerCtx) => {
            try {
                await withServiceTransaction(async () => {
                    throw new Error('inner failure');
                });
            } catch {
                // Inner boundary rolled back independently; outer continues.
            }

            // Work that belongs to the outer boundary proceeds normally.
            outerCommitted = true;
        });

        expect(outerCommitted).toBe(true);
    });

    it('inner transaction error does not propagate to outer when caught', async () => {
        const outerResult = await withServiceTransaction(async () => {
            let innerFailed = false;

            try {
                await withServiceTransaction(async () => {
                    throw new Error('inner rollback');
                });
            } catch {
                innerFailed = true;
            }

            expect(innerFailed).toBe(true);
            return 'outer-success';
        });

        expect(outerResult).toBe('outer-success');
    });

    it('each nested call opens a separate withTransaction invocation', async () => {
        const { withTransaction } = await import('@repo/db');
        const withTransactionSpy = withTransaction as ReturnType<typeof vi.fn>;

        await withServiceTransaction(async () => {
            await withServiceTransaction(async () => {
                // inner body
            });
        });

        // withTransaction must have been called twice — once for the outer
        // boundary and once for the inner, independent boundary.
        expect(withTransactionSpy).toHaveBeenCalledTimes(2);
    });
});
