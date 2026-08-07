/**
 * @fileoverview
 * HOS-375 round-2 review finding — `findExistingSuperAdmin` (reached through the
 * exported {@link findSuperAdminActor}) must resolve the SAME super admin on
 * every run, on a database that holds more than one.
 *
 * ## Why this matters beyond tidiness
 *
 * The query is `... WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL LIMIT 1`.
 * `LIMIT 1` with no `ORDER BY` returns whatever row Postgres hands back first,
 * which is not a stable property of the data — it can change after a `VACUUM`,
 * a plan change, or a concurrent update that moves a tuple.
 *
 * `packages/seed/src/data-migrations/0042-reattribute-imported-events.ts`
 * resolves its fallback actor through this function and THROWS by design when
 * that actor is not the one `0027`/`0028` ran as. So a non-deterministic pick
 * does not quietly choose a different-but-equivalent actor — it aborts `0042`
 * and blocks `0043`/`0044` from applying at all.
 *
 * ## How this is tested without a live Postgres
 *
 * The mock client below EMULATES the ordering step: it records the `ORDER BY`
 * expressions it is handed, serialises them with Drizzle's real `PgDialect`
 * (which needs no connection), and sorts its fixture rows accordingly before
 * applying `LIMIT`. That makes the assertion behavioural rather than
 * structural — with the `ORDER BY` removed, the mock returns rows in the
 * physical order it was given and the two differently-shuffled fixtures below
 * resolve to different actors, exactly as a real database would.
 *
 * The fixture rows carry `createdAt`, which the real projection does not
 * select. That is correct: Postgres evaluates `ORDER BY` against the table, not
 * against the projected column list.
 */
import type { DrizzleClient } from '@repo/db';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { findSuperAdminActor } from '../../src/utils/superAdminLoader.js';

/** A stand-in `users` row, carrying the columns the ORDER BY reads. */
interface SuperAdminFixtureRow {
    readonly id: string;
    readonly displayName: string | null;
    readonly email: string;
    readonly createdAt: Date;
}

/** Serialised-SQL fragment → the fixture-row key it orders by. */
const ORDER_KEY_BY_SQL_FRAGMENT: ReadonlyArray<readonly [string, keyof SuperAdminFixtureRow]> = [
    ['created_at', 'createdAt'],
    ['"id"', 'id']
];

const dialect = new PgDialect();

/**
 * Sorts fixture rows the way Postgres would, given the `ORDER BY` expressions
 * the query builder actually received.
 *
 * @param rows - Rows in their (arbitrary) physical order.
 * @param orderByArgs - The expressions passed to `.orderBy(...)`, in order.
 * @returns A new, sorted array. Returns a copy of the input untouched when no
 *   ordering was requested — which is precisely the buggy behaviour under test.
 */
function applyOrderBy(
    rows: readonly SuperAdminFixtureRow[],
    orderByArgs: readonly unknown[]
): SuperAdminFixtureRow[] {
    const keys = orderByArgs.map((arg) => {
        const text = dialect.sqlToQuery(arg as SQL).sql;
        const match = ORDER_KEY_BY_SQL_FRAGMENT.find(([fragment]) => text.includes(fragment));
        if (!match) {
            throw new Error(`Unrecognised ORDER BY expression in test emulator: ${text}`);
        }
        return match[1];
    });

    return [...rows].sort((a, b) => {
        for (const key of keys) {
            const left = a[key];
            const right = b[key];
            if (left < right) return -1;
            if (left > right) return 1;
        }
        return 0;
    });
}

/**
 * A minimal Drizzle-shaped query builder that records its `ORDER BY` and
 * resolves on `.limit()`.
 *
 * @param rows - Fixture rows in the physical order the "database" holds them.
 * @returns The stand-in client plus the recorded `ORDER BY` calls.
 */
function buildMockDb(rows: readonly SuperAdminFixtureRow[]): {
    db: DrizzleClient;
    orderByCalls: unknown[][];
} {
    const orderByCalls: unknown[][] = [];

    const builder = {
        select: () => builder,
        from: () => builder,
        innerJoin: () => builder,
        where: () => builder,
        orderBy: (...args: unknown[]) => {
            orderByCalls.push(args);
            return builder;
        },
        limit: (n: number) =>
            Promise.resolve(applyOrderBy(rows, orderByCalls.at(-1) ?? []).slice(0, n))
    };

    return { db: builder as unknown as DrizzleClient, orderByCalls };
}

const FIRST_SUPER_ADMIN: SuperAdminFixtureRow = {
    id: '11111111-1111-4111-8111-111111111111',
    displayName: 'Super Admin',
    email: 'superadmin@hospeda.com',
    createdAt: new Date('2024-01-01T00:00:00.000Z')
};

const SECOND_SUPER_ADMIN: SuperAdminFixtureRow = {
    id: '22222222-2222-4222-8222-222222222222',
    displayName: 'Promoted Staff',
    email: 'staff@hospeda.com',
    createdAt: new Date('2025-06-01T00:00:00.000Z')
};

const THIRD_SUPER_ADMIN: SuperAdminFixtureRow = {
    id: '33333333-3333-4333-8333-333333333333',
    displayName: 'Later Staff',
    email: 'later@hospeda.com',
    createdAt: new Date('2026-02-01T00:00:00.000Z')
};

describe('findSuperAdminActor — determinism with multiple super admins', () => {
    it('resolves the SAME actor regardless of the physical row order', async () => {
        // Arrange: the same three super admins, handed back in two different
        // physical orders — what a VACUUM or a plan change can produce.
        const orderA = [SECOND_SUPER_ADMIN, THIRD_SUPER_ADMIN, FIRST_SUPER_ADMIN];
        const orderB = [THIRD_SUPER_ADMIN, FIRST_SUPER_ADMIN, SECOND_SUPER_ADMIN];

        // Act
        const resolvedA = await findSuperAdminActor({ db: buildMockDb(orderA).db });
        const resolvedB = await findSuperAdminActor({ db: buildMockDb(orderB).db });

        // Assert: same actor both times, and specifically the OLDEST one — the
        // super admin the earliest data-migrations necessarily ran as.
        expect(resolvedA?.id).toBe(FIRST_SUPER_ADMIN.id);
        expect(resolvedB?.id).toBe(FIRST_SUPER_ADMIN.id);
        expect(resolvedA?.id).toBe(resolvedB?.id);
    });

    it('orders by created_at then id, so a shared timestamp cannot reintroduce ambiguity', async () => {
        // Arrange: two accounts promoted in the same seed run share a timestamp.
        // `created_at` alone leaves them tied; the `id` tiebreak resolves it.
        const sameInstant = new Date('2025-06-01T00:00:00.000Z');
        const tiedLow: SuperAdminFixtureRow = { ...SECOND_SUPER_ADMIN, createdAt: sameInstant };
        const tiedHigh: SuperAdminFixtureRow = { ...THIRD_SUPER_ADMIN, createdAt: sameInstant };

        // Act
        const resolvedA = await findSuperAdminActor({ db: buildMockDb([tiedHigh, tiedLow]).db });
        const resolvedB = await findSuperAdminActor({ db: buildMockDb([tiedLow, tiedHigh]).db });

        // Assert
        expect(resolvedA?.id).toBe(tiedLow.id);
        expect(resolvedB?.id).toBe(tiedLow.id);
    });

    it('asks for exactly one ORDER BY, on users.created_at ASC then users.id ASC', async () => {
        // Structural companion to the behavioural assertions above: it pins WHICH
        // columns, so a future edit cannot keep the tests green by ordering on a
        // mutable column (email / display_name) that would drift under a rename.
        const { db, orderByCalls } = buildMockDb([FIRST_SUPER_ADMIN]);

        await findSuperAdminActor({ db });

        expect(orderByCalls).toHaveLength(1);
        const serialised = (orderByCalls[0] ?? []).map((arg) => dialect.sqlToQuery(arg as SQL).sql);
        expect(serialised).toEqual(['"users"."created_at" asc', '"users"."id" asc']);
    });

    it('still returns null when no super admin exists', async () => {
        // Non-vacuity guard: the ordering must not have turned the empty case
        // into a throw or an undefined.
        const resolved = await findSuperAdminActor({ db: buildMockDb([]).db });

        expect(resolved).toBeNull();
    });
});
