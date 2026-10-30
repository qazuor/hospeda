/**
 * Test doubles for the listing write path after HOS-1499.
 *
 * Every listing create/update now runs inside a transaction and writes an
 * owner-act event to `domain_event` from its after-hook. Unit suites that mock
 * the models have no database, so they need:
 *
 * - a stand-in for `withServiceTransaction` that hands the callback a fake
 *   `tx`, merged over the caller's context exactly like the real one;
 * - a stand-in for `domainEventModel`, which would otherwise reach for the
 *   real client.
 *
 * The real event write is covered by the DB integration suite
 * (`test/integration/services/listing-owner-act.integration.test.ts`).
 */

import type { InsertDomainEventInput } from '@repo/db';
import type { ServiceContext } from '../../src/types';

/** The fake transaction handle the stand-in injects. */
export const FAKE_SERVICE_TX = { __fakeServiceTx: true } as const;

/** The fake transaction handle the DB-level stand-in injects. */
export const FAKE_DB_TX = { __fakeDbTx: true } as const;

/**
 * Faithful stand-in for `@repo/db`'s `withTransaction`: runs the callback with
 * a fake transaction handle (joining an existing one when given), exactly like
 * the real one. Errors propagate, as they do from a rolled-back real
 * transaction.
 *
 * The handle is the {@link FAKE_DB_TX} marker: suites that mock the model
 * classes never query it, and suites that run REAL models against a
 * `setDb(...)` stub must override this stand-in with one that hands the
 * callback the stubbed client (see the media test files for the pattern).
 * NOTE: this module must NOT import `@repo/db` at runtime — a vi.mock factory
 * that awaits this file while the mock is still being built would deadlock.
 */
export async function fakeDbWithTransaction<T>(
    fn: (tx: unknown) => Promise<T>,
    existingTx?: unknown
): Promise<T> {
    return fn(existingTx ?? FAKE_DB_TX);
}

/**
 * Faithful stand-in for `withServiceTransaction`: merges the base context,
 * injects {@link FAKE_SERVICE_TX} and runs the callback. Errors propagate, as
 * they do from a rolled-back real transaction.
 */
export async function fakeWithServiceTransaction<T>(
    fn: (ctx: ServiceContext) => Promise<T>,
    baseCtx?: Partial<ServiceContext>
): Promise<T> {
    return fn({
        ...baseCtx,
        tx: FAKE_SERVICE_TX as unknown as ServiceContext['tx'],
        hookState: baseCtx?.hookState ?? {}
    });
}

/**
 * Stand-in for `domainEventModel`, for a partial `vi.mock('@repo/db')`:
 * owner-act writes resolve without a DB and are captured in `writes`.
 *
 * A plain function rather than a `vi.fn()` on purpose: the suites that use it
 * call `vi.restoreAllMocks()` / `vi.resetAllMocks()` in their own hooks, which
 * would strip a mock implementation and send the write to the real client.
 */
export const domainEventModelDouble = {
    writes: [] as InsertDomainEventInput[],
    async insert(input: InsertDomainEventInput): Promise<Record<string, never>> {
        domainEventModelDouble.writes.push(input);
        return {};
    }
};
