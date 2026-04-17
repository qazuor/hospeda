/**
 * Tests for withServiceTransaction error propagation edge cases (SPEC-059 GAP-033).
 *
 * Verifies:
 * (a) Non-Error objects thrown inside the callback are preserved as-is.
 * (b) Errors thrown by tx.execute (before the callback body runs) propagate out.
 * (c) A ServiceError thrown inside the callback keeps its ServiceErrorCode and is
 *     NOT re-wrapped as INTERNAL_ERROR.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceError } from '../../src/types';
import '../setupTest';

// ---------------------------------------------------------------------------
// Mock @repo/db — same pattern as transaction.test.ts
// ---------------------------------------------------------------------------

const mockExecute = vi.fn();

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = { execute: mockExecute };
        return cb(mockTx);
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withServiceTransaction — error propagation edge cases (SPEC-059 GAP-033)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue(undefined);
    });

    it('GAP-033a: non-Error objects thrown inside callback are preserved', async () => {
        // Arrange — throw a plain object (not an Error instance)
        const nonErrorObject = { code: 'CUSTOM_CODE', detail: 'some detail' };

        // Act & Assert — the thrown value must propagate unchanged
        await expect(
            withServiceTransaction(async () => {
                throw nonErrorObject;
            })
        ).rejects.toStrictEqual(nonErrorObject);
    });

    it('GAP-033b: errors thrown by tx.execute before callback body propagate out', async () => {
        // Arrange — make the SET LOCAL statement_timeout call fail
        const dbError = new Error('statement_timeout execute failed');
        mockExecute.mockRejectedValue(dbError);

        // Act & Assert — the execute failure must bubble up to the caller
        await expect(
            withServiceTransaction(async () => {
                return 'should never reach here';
            })
        ).rejects.toThrow('statement_timeout execute failed');
    });

    it('GAP-033c: ServiceError thrown inside callback keeps its ServiceErrorCode (not re-wrapped)', async () => {
        // Arrange — throw a ServiceError with a specific code
        const originalError = new ServiceError(ServiceErrorCode.NOT_FOUND, 'Entity not found');

        // Act & Assert — withServiceTransaction propagates the original ServiceError;
        // the code must remain NOT_FOUND, not INTERNAL_ERROR.
        const thrown = await withServiceTransaction(async () => {
            throw originalError;
        }).catch((e: unknown) => e);

        expect(thrown).toBeInstanceOf(ServiceError);
        const serviceError = thrown as ServiceError;
        expect(serviceError.code).toBe(ServiceErrorCode.NOT_FOUND);
        expect(serviceError.message).toBe('Entity not found');
    });
});
