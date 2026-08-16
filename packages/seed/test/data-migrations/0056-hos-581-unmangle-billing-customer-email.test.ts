/**
 * @fileoverview
 * Unit tests for the `0056-hos-581-unmangle-billing-customer-email` data
 * migration, using a mocked query chain — no real database connection. Same
 * style as `0054-hos374-editorial-trusted-editor.test.ts`.
 *
 * WHAT THESE TESTS CANNOT SEE, stated so nobody mistakes them for full
 * coverage: with a fake `db`, the `where(...)` predicate is never evaluated.
 * The narrowing rule this migration leans on —
 * `billing_customers.email = replace(users.email, '+', '.')`, which is what
 * keeps it from clobbering rows that diverged for some other reason — is NOT
 * exercised here. These tests cover the orchestration around it: that a match
 * produces exactly one targeted UPDATE per row, that an empty result writes
 * nothing at all, and that the summary names what changed. The predicate
 * itself is verified by running the migration against a database.
 *
 * @module test/data-migrations/0056-hos-581-unmangle-billing-customer-email
 */
import { describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0056-hos-581-unmangle-billing-customer-email.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

interface CandidateRow {
    readonly customerId: string;
    readonly mangled: string;
    readonly real: string;
}

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** One entry per `update().set()` call, in order. */
    readUpdates: () => readonly Record<string, unknown>[];
}

/**
 * Builds a fake `ctx.db` covering the two chains the migration uses:
 * `select().from().innerJoin().where()` and `update().set().where()`.
 *
 * @param selectResult - Rows the candidate lookup resolves to.
 */
function buildFakeDb(selectResult: readonly CandidateRow[]): FakeDbProbe {
    const updates: Record<string, unknown>[] = [];

    const db = {
        select: () => ({
            from: () => ({
                innerJoin: () => ({
                    where: () => Promise.resolve(selectResult)
                })
            })
        }),
        update: () => ({
            set: (values: Record<string, unknown>) => {
                updates.push(values);
                return { where: () => Promise.resolve(undefined) };
            }
        })
    } as unknown as SeedMigrationCtx['db'];

    return { db, readUpdates: () => updates };
}

function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db } as unknown as SeedMigrationCtx;
}

describe('0056-hos-581-unmangle-billing-customer-email', () => {
    it('is declared non-destructive and required', () => {
        expect(migration.meta.destructive).toBe(false);
        expect(migration.meta.group).toBe('required');
    });

    it('writes NOTHING when no row is mangled', async () => {
        // The common case on a fresh environment. A migration that issued an
        // UPDATE anyway would be a silent no-op that still churns rows.
        const probe = buildFakeDb([]);

        const result = await migration.up(buildCtx(probe.db));

        expect(probe.readUpdates()).toHaveLength(0);
        expect(result.summary).toContain('nothing to converge');
    });

    it('restores each mangled row to the real address', async () => {
        const probe = buildFakeDb([
            {
                customerId: 'cus_1',
                mangled: 'qazuor.turista@gmail.com',
                real: 'qazuor+turista@gmail.com'
            },
            {
                customerId: 'cus_2',
                mangled: 'qazuor.r1host@gmail.com',
                real: 'qazuor+r1host@gmail.com'
            }
        ]);

        const result = await migration.up(buildCtx(probe.db));

        // One UPDATE per row, each carrying the address the user typed —
        // never the sanitized one it is replacing.
        expect(probe.readUpdates()).toEqual([
            { email: 'qazuor+turista@gmail.com' },
            { email: 'qazuor+r1host@gmail.com' }
        ]);
        expect(result.summary).toContain('2');
        // The summary names both sides, because this runs against production
        // and a bare row count is not an audit trail.
        expect(result.summary).toContain('qazuor.turista@gmail.com');
        expect(result.summary).toContain('qazuor+turista@gmail.com');
    });
});
