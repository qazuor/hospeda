/**
 * @fileoverview
 * Unit tests for the `0058-purge-seed-example-data` data migration, using a
 * mocked query chain — no real database connection.
 *
 * This is the HOS-261 phase-2 hard delete: it removes the seed `example`
 * dataset that phase 1 soft-deleted on 2026-07-23. Two behaviours are worth
 * pinning, because either one failing silently is expensive:
 *
 * 1. **The production-only gate.** Staging and local keep their demo data; a
 *    regression here wipes them on the next `db:seed:migrate`.
 * 2. **The infrastructure guard.** It is what stops `guest` — the actor every
 *    anonymous API request is built from — from being deleted. Before
 *    2026-08-19 that account was surviving only because the allowlist carried a
 *    stale domain (`guest@hospeda.com` vs the real `guest@hospeda.com.ar`).
 *
 * @module test/data-migrations/0058-purge-seed-example-data
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0058-purge-seed-example-data.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-0058-purge-example',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** How many statements of any kind were issued. */
    statementCount: () => number;
}

/**
 * Builds a fake `ctx.db` that answers every chain the migration uses with an
 * empty result, and counts how many statements were issued.
 */
function buildFakeDb(): FakeDbProbe {
    let statements = 0;

    const emptyThenable = () => {
        statements += 1;
        return Promise.resolve([]);
    };

    const db = {
        select: () => ({
            from: () => ({
                where: emptyThenable
            })
        }),
        delete: () => ({
            where: () => ({
                returning: emptyThenable
            })
        })
    } as unknown as SeedMigrationCtx['db'];

    return { db, statementCount: () => statements };
}

/** Minimal context accepted by `up`. */
function buildCtx(db: SeedMigrationCtx['db']): SeedMigrationCtx {
    return { db, actor: STUB_ACTOR } as unknown as SeedMigrationCtx;
}

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('meta', () => {
    it('declares a name matching its filename', () => {
        // The ledger is keyed by `name`; a mismatch makes the migration
        // re-runnable forever or unapplicable at all.
        expect(migration.meta.name).toBe('0058-purge-seed-example-data');
    });

    it('is in the `required` group so the prod gate does not refuse it', () => {
        expect(migration.meta.group).toBe('required');
    });

    it('is marked destructive so it needs the explicit opt-in', () => {
        expect(migration.meta.destructive).toBe(true);
    });
});

describe('production-only gate', () => {
    for (const env of ['development', 'test']) {
        it(`skips without issuing a single statement when NODE_ENV is ${env}`, async () => {
            process.env.NODE_ENV = env;

            const probe = buildFakeDb();
            const result = await migration.up(buildCtx(probe.db));

            expect(result.counts).toEqual({ skipped: 1 });
            expect(result.summary).toContain('production only');
            // Load-bearing: staging and local keep their demo data because
            // nothing is ever executed, not because the deletes matched zero.
            expect(probe.statementCount()).toBe(0);
        });
    }

    it('does proceed when NODE_ENV is production', async () => {
        process.env.NODE_ENV = 'production';

        const probe = buildFakeDb();
        const result = await migration.up(buildCtx(probe.db));

        // The negative control for the two cases above: with the gate open the
        // migration really does reach the database, so their zero means the
        // gate held rather than the fake being inert.
        expect(probe.statementCount()).toBeGreaterThan(0);
        expect(result.counts).not.toEqual({ skipped: 1 });
    });
});

describe('in production, against an already-purged database', () => {
    it('is a no-op on re-run and reports zeros', async () => {
        process.env.NODE_ENV = 'production';

        const probe = buildFakeDb();
        const result = await migration.up(buildCtx(probe.db));
        const counts = result.counts as Record<string, number>;

        expect(counts.usersDeleted).toBe(0);
        expect(counts.usersResolvedCandidates).toBe(0);
        expect(counts.usersProtectedAsInfrastructure).toBe(0);
        expect(result.summary).toContain('protected as infrastructure');
    });
});
