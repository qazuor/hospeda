/**
 * @fileoverview
 * Integration tests for the timeoutMs option of withServiceTransaction.
 *
 * withServiceTransaction sets statement_timeout via SET LOCAL before invoking
 * the callback. These tests verify that:
 *   1. The timeoutMs value is forwarded to the underlying withTransaction
 *      callback as a SET LOCAL statement_timeout execution.
 *   2. When the mocked withTransaction simulates a timeout abort, the error
 *      propagates to the caller.
 *   3. A slow callback combined with a mocked timeout produces a thrown error
 *      that mentions the timeout.
 *
 * The implementation delegates timeout enforcement to the database driver via
 * `SET LOCAL statement_timeout = N`. Because no live database is used here,
 * timeout behavior is verified by:
 *   (a) confirming the correct timeoutMs is forwarded to tx.execute as the
 *       raw SQL value, and
 *   (b) confirming that when the mock throws a timeout error, it propagates.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '../../src/types';
import '../setupTest';

// ---------------------------------------------------------------------------
// We need fine-grained control over mockTx.execute for the timeout tests,
// so we define a mutable mock that individual tests can reconfigure.
// ---------------------------------------------------------------------------

const mockExecute = vi.fn().mockResolvedValue(undefined);

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = { execute: mockExecute };
        return cb(tx);
    }),
    buildSearchCondition: vi.fn(() => undefined),
    BaseModelImpl: class {}
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

// Dynamic import must come after mocks are registered.
const { withServiceTransaction } = await import('../../src/utils/transaction');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withServiceTransaction — timeoutMs option (SPEC-059)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockExecute.mockResolvedValue(undefined);
    });

    /**
     * TC-TO-01: The timeoutMs value is passed through to the tx.execute call
     * that sets the statement_timeout. The raw numeric string must appear in
     * the sql-raw token emitted by sql.raw(String(timeout)).
     *
     * withServiceTransaction calls:
     *   await tx.execute(sql`SET LOCAL statement_timeout = ${sql.raw(String(timeout))}`)
     *
     * The mocked sql tag wraps this into { type: 'sql', strings, _values } where
     * _values[0] is { type: 'sql-raw', value: '5000' }. We assert that tx.execute
     * was called with a value whose _values array contains the raw token carrying
     * the expected timeout string.
     */
    it('TC-TO-01: timeoutMs value is forwarded to tx.execute as the SET LOCAL timeout', async () => {
        // Arrange
        const customTimeoutMs = 5_000;

        // Act
        await withServiceTransaction(async () => 'ok', undefined, { timeoutMs: customTimeoutMs });

        // Assert — tx.execute was called once (for SET LOCAL statement_timeout)
        expect(mockExecute).toHaveBeenCalledTimes(1);

        const [sqlExpr] = mockExecute.mock.calls[0] as [
            { _values: { type: string; value: string }[] }
        ];

        // The _values array of the sql template tag must contain the raw timeout token.
        expect(sqlExpr._values).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'sql-raw',
                    value: String(customTimeoutMs)
                })
            ])
        );
    });

    /**
     * TC-TO-02: The default timeout (30 000 ms) is applied when timeoutMs is
     * omitted from options.
     */
    it('TC-TO-02: default timeout of 30000ms is applied when timeoutMs is not provided', async () => {
        // Arrange — no options passed

        // Act
        await withServiceTransaction(async () => 'ok');

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);

        const [sqlExpr] = mockExecute.mock.calls[0] as [
            { _values: { type: string; value: string }[] }
        ];

        expect(sqlExpr._values).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'sql-raw',
                    value: '30000'
                })
            ])
        );
    });

    /**
     * TC-TO-03: When tx.execute throws a timeout error (simulating the Postgres
     * driver aborting due to statement_timeout), withServiceTransaction propagates
     * the error to the caller. The caller should see an error that can be
     * associated with a timeout condition.
     */
    it('TC-TO-03: a timeout error from tx.execute propagates out of withServiceTransaction', async () => {
        // Arrange — simulate the database driver rejecting with a timeout error
        const timeoutError = new Error('canceling statement due to statement timeout');
        mockExecute.mockRejectedValue(timeoutError);

        // Act & Assert
        await expect(
            withServiceTransaction(async () => 'should not reach here', undefined, {
                timeoutMs: 10
            })
        ).rejects.toThrow('canceling statement due to statement timeout');
    });

    /**
     * TC-TO-04: When the mocked withTransaction itself simulates a timeout abort
     * (i.e., it rejects with a timeout error after the callback runs past the
     * budget), withServiceTransaction propagates that error.
     *
     * This models the case where the DB driver, not just tx.execute, aborts
     * the transaction due to exceeding the configured timeout.
     */
    it('TC-TO-04: when withTransaction aborts with a timeout error, it propagates', async () => {
        // Arrange — reconfigure the withTransaction mock to simulate a driver-level timeout
        const { withTransaction } = await import('@repo/db');
        const withTransactionMock = withTransaction as ReturnType<typeof vi.fn>;

        withTransactionMock.mockRejectedValueOnce(
            new Error('ERROR: canceling statement due to statement timeout')
        );

        // Act & Assert
        await expect(
            withServiceTransaction(
                async (_ctx: ServiceContext) => {
                    // callback body is irrelevant; the mock rejects before it returns
                    return 'value';
                },
                undefined,
                { timeoutMs: 10 }
            )
        ).rejects.toThrow('statement timeout');
    });

    /**
     * TC-TO-05: A slow callback combined with a mocked timeout produces a thrown
     * error. The mock simulates the Postgres driver canceling the statement when
     * the callback takes longer than timeoutMs.
     *
     * Implementation note: withServiceTransaction sets statement_timeout via
     * SET LOCAL before invoking fn(ctx). In production, the DB driver enforces
     * the timeout at the SQL level. In this test we simulate that enforcement
     * by making tx.execute reject when the timeout elapses during the callback.
     */
    it('TC-TO-05: slow callback exceeding timeoutMs results in a thrown error', async () => {
        // Arrange — make tx.execute simulate a timeout abort on the second call
        // (the first call is the SET LOCAL; subsequent calls would be user queries)
        let callCount = 0;
        mockExecute.mockImplementation(async () => {
            callCount++;
            if (callCount === 1) {
                // First call: SET LOCAL statement_timeout — succeeds immediately
                return undefined;
            }
            // Subsequent calls: simulate driver timeout enforcement
            throw new Error('canceling statement due to statement timeout');
        });

        // Act — slowCb calls tx.execute to simulate a query that triggers the timeout
        await expect(
            withServiceTransaction(
                async (ctx) => {
                    // Simulate a slow query by calling execute on the transaction client.
                    // biome-ignore lint/suspicious/noExplicitAny: test-only access to tx internals
                    await (ctx.tx as any).execute({ sql: 'SELECT pg_sleep(1)' });
                    return 'should not reach here';
                },
                undefined,
                { timeoutMs: 10 }
            )
        ).rejects.toThrow('statement timeout');
    });

    /**
     * TC-TO-06: Verifies that timeoutMs: 0 is forwarded literally (edge case —
     * a zero timeout would immediately abort any statement in real Postgres).
     */
    it('TC-TO-06: timeoutMs of 0 is forwarded as "0" to SET LOCAL statement_timeout', async () => {
        // Arrange
        // Act
        await withServiceTransaction(async () => 'ok', undefined, { timeoutMs: 0 });

        // Assert
        expect(mockExecute).toHaveBeenCalledTimes(1);

        const [sqlExpr] = mockExecute.mock.calls[0] as [
            { _values: { type: string; value: string }[] }
        ];

        expect(sqlExpr._values).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'sql-raw',
                    value: '0'
                })
            ])
        );
    });
});
