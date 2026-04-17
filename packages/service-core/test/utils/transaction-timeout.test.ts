/**
 * @fileoverview
 * Tests for the timeoutMs option of withServiceTransaction.
 *
 * Verifies that:
 * - A custom timeoutMs value is forwarded as the SQL statement_timeout literal
 * - The default timeout (30_000) is used when timeoutMs is not provided
 *
 * These fill the SPEC-059 gap: the existing transaction.test.ts only asserts that
 * execute() was called once, never that the correct timeout value was passed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../setupTest';

const mockExecute = vi.fn().mockResolvedValue(undefined);

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

describe('withServiceTransaction — timeoutMs option', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue(undefined);
    });

    it('passes timeoutMs: 500 to the SET LOCAL statement_timeout SQL call', async () => {
        // Arrange
        const timeoutMs = 500;

        // Act
        await withServiceTransaction(async () => 'done', undefined, { timeoutMs });

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);

        const sqlArg = mockExecute.mock.calls[0]?.[0] as {
            type: string;
            _values: Array<{ type: string; value: string }>;
        };

        expect(sqlArg).toBeDefined();
        expect(sqlArg._values).toHaveLength(1);
        expect(sqlArg._values[0]).toEqual({ type: 'sql-raw', value: '500' });
    });

    it('passes the default timeout (30000) when timeoutMs is not provided', async () => {
        // Arrange — no options argument

        // Act
        await withServiceTransaction(async () => 'done');

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);

        const sqlArg = mockExecute.mock.calls[0]?.[0] as {
            type: string;
            _values: Array<{ type: string; value: string }>;
        };

        expect(sqlArg).toBeDefined();
        expect(sqlArg._values).toHaveLength(1);
        expect(sqlArg._values[0]).toEqual({ type: 'sql-raw', value: '30000' });
    });
});
