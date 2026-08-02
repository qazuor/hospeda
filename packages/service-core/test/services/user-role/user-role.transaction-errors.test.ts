/**
 * Regression tests for the error contract of the HOS-296 write primitives when
 * they run through the REAL `withTransaction` (HTTP callers, no `ctx.tx`).
 *
 * The sibling suite (`user-role.service.test.ts`) replaces `withTransaction`
 * with an in-memory double, and the route suite mocks `@repo/service-core`
 * wholesale — so BOTH hid the fact that `@repo/db`'s `withTransaction` wrapped
 * every non-`DbError` into a `DbError`. A `ServiceError` thrown by the
 * last-role guard therefore reached `toErrorOutput` as a `DbError`, failed the
 * `instanceof ServiceError` check and was rewritten to `INTERNAL_ERROR` — the
 * admin endpoint answered **500** where it documents 400 / 404.
 *
 * These tests deliberately use the real `withTransaction`: only `getDb()` is
 * replaced (via the package's own `setDb` test seam) with a fake client whose
 * `transaction()` runs the callback and lets its error propagate, which is
 * exactly the path a production HTTP request takes.
 *
 * @module test/services/user-role/user-role.transaction-errors
 */

import type { DrizzleClient } from '@repo/db';
import { setDb, users } from '@repo/db';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { afterEach, describe, expect, it } from 'vitest';
import { revokeRole } from '../../../src/services/user-role/user-role.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

/** Rows the fake transaction client answers with, per queried table. */
interface FakeRows {
    readonly userRows: readonly { id: string }[];
    readonly roleRows: readonly { role: RoleEnum }[];
}

/**
 * Builds a transaction client that answers the two SELECTs `revokeRole`
 * issues (the `FOR UPDATE` lock on `users`, then the held-roles read) with
 * fixed rows. Predicates are ignored — this double exists to drive the error
 * paths, not to emulate SQL.
 *
 * @param rows - Rows returned per table.
 * @returns A `DrizzleClient`-shaped double.
 */
const buildFakeTx = (rows: FakeRows): DrizzleClient => {
    const answer = (table: unknown) =>
        table === users ? rows.userRows : (rows.roleRows as readonly unknown[]);

    return {
        select: () => ({
            from: (table: unknown) => ({
                where: () => ({
                    // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders ARE thenables; the double has to be awaitable to stand in for one
                    then: (
                        onFulfilled?: (value: unknown) => unknown,
                        onRejected?: (reason: unknown) => unknown
                    ) => Promise.resolve(answer(table)).then(onFulfilled, onRejected),
                    for: async () => answer(table)
                })
            })
        })
    } as any;
};

/** Installs a db whose `transaction()` runs the callback against `tx`. */
const installDb = (tx: DrizzleClient): void => {
    setDb({
        transaction: async (callback: (client: DrizzleClient) => Promise<unknown>) => callback(tx)
    } as any);
};

afterEach(() => {
    // Clear the singleton so an unrelated suite never inherits the double.
    setDb(null as unknown as DrizzleClient);
});

describe('revokeRole error codes through the real withTransaction (HOS-296)', () => {
    it('reports NOT_FOUND — not INTERNAL_ERROR — for an unknown user', async () => {
        // Arrange — no `users` row, so the FOR UPDATE lock finds nothing.
        installDb(buildFakeTx({ userRows: [], roleRows: [] }));

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert — the route maps this to HTTP 404.
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });

    it('reports VALIDATION_ERROR — not INTERNAL_ERROR — for the last-role guard', async () => {
        // Arrange — the user exists and wears exactly one hat.
        installDb(
            buildFakeTx({ userRows: [{ id: USER_ID }], roleRows: [{ role: RoleEnum.HOST }] })
        );

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert — the route maps this to HTTP 400.
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(result.error?.message).toMatch(/last role/i);
    });

    it('still reports INTERNAL_ERROR for a genuine database failure', async () => {
        // Arrange — the driver blows up rather than the guard rejecting.
        setDb({
            transaction: async () => {
                throw new Error('connection terminated unexpectedly');
            }
        } as any);

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
    });
});
