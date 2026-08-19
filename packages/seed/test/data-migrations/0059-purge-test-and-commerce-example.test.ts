/**
 * @fileoverview
 * Unit tests for the `0059-purge-test-and-commerce-example` data migration,
 * using a mocked query chain — no real database connection. Same style as
 * `0054-hos374-editorial-trusted-editor.test.ts`.
 *
 * Three things are worth pinning here, because each one is a way this migration
 * could quietly do the wrong thing in production:
 *
 * 1. **The production-only gate.** Staging and local must keep their demo data.
 *    A regression here wipes them on the next `db:seed:migrate`.
 * 2. **The infrastructure guard.** `guest` is the actor every anonymous API
 *    request is built from; deleting it takes the API down.
 * 3. **The literal lists.** They must never match the owner's own account, which
 *    owns the only public accommodation on the site.
 *
 * @module test/data-migrations/0059-purge-test-and-commerce-example
 */
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0059-purge-test-and-commerce-example.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-0059-purge-test',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

interface FakeDbProbe {
    readonly db: SeedMigrationCtx['db'];
    /** How many `delete(...)` chains were started. */
    deleteCount: () => number;
    /** How many `select(...)` chains were started. */
    selectCount: () => number;
}

/**
 * Builds a fake `ctx.db` covering the two chains the migration uses:
 * `select().from().where()` (awaited directly) and
 * `delete().where().returning()`.
 *
 * @param selectResults - One array per `select` call, in call order.
 * @param deleteResults - One array per `delete` call, in call order.
 */
function buildFakeDb(params: {
    readonly selectResults: readonly (readonly Record<string, unknown>[])[];
    readonly deleteResults: readonly (readonly Record<string, unknown>[])[];
}): FakeDbProbe {
    let selectCalls = 0;
    let deleteCalls = 0;

    const db = {
        select: () => {
            const index = selectCalls;
            selectCalls += 1;
            return {
                from: () => ({
                    where: () => Promise.resolve(params.selectResults[index] ?? [])
                })
            };
        },
        delete: () => {
            const index = deleteCalls;
            deleteCalls += 1;
            return {
                where: () => ({
                    returning: () => Promise.resolve(params.deleteResults[index] ?? [])
                })
            };
        }
    } as unknown as SeedMigrationCtx['db'];

    return {
        db,
        deleteCount: () => deleteCalls,
        selectCount: () => selectCalls
    };
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
        expect(migration.meta.name).toBe('0059-purge-test-and-commerce-example');
    });

    it('is in the `required` group so the prod gate does not refuse it', () => {
        // `prodGate.ts` refuses every `example`-group migration in production
        // unconditionally. The group describes the migration (a maintenance
        // operation), not the origin of the data it removes.
        expect(migration.meta.group).toBe('required');
    });

    it('is marked destructive so it needs the explicit opt-in', () => {
        expect(migration.meta.destructive).toBe(true);
    });
});

describe('production-only gate', () => {
    for (const env of ['development', 'test', undefined]) {
        it(`skips without touching the database when NODE_ENV is ${String(env)}`, async () => {
            if (env === undefined) {
                process.env.NODE_ENV = undefined;
            } else {
                process.env.NODE_ENV = env;
            }

            const probe = buildFakeDb({ selectResults: [], deleteResults: [] });
            const result = await migration.up(buildCtx(probe.db));

            expect(result.counts).toEqual({ skipped: 1 });
            expect(result.summary).toContain('production only');
            // The load-bearing assertion: staging and local keep their data
            // because the migration never issues a statement at all.
            expect(probe.deleteCount()).toBe(0);
            expect(probe.selectCount()).toBe(0);
        });
    }
});

describe('in production', () => {
    beforeEach(() => {
        process.env.NODE_ENV = 'production';
    });

    it('refuses to delete an infrastructure account even if it matches the list', async () => {
        // `guest` reached production owning seed rows. If it ever lands in the
        // resolved candidate set, the guard — not the list — is what saves it.
        const probe = buildFakeDb({
            selectResults: [
                [
                    { id: 'user-guest', email: 'guest@hospeda.com.ar' },
                    { id: 'user-smoke', email: 'qazuor+smoke2@gmail.com' }
                ],
                [],
                [],
                [],
                []
            ],
            deleteResults: []
        });

        const result = await migration.up(buildCtx(probe.db));
        const counts = result.counts as Record<string, number>;

        expect(counts.usersProtectedAsInfrastructure).toBe(1);
        expect(result.summary).toContain('protected as infrastructure');
    });

    it('reports the accounts it resolved', async () => {
        const probe = buildFakeDb({
            selectResults: [
                [
                    { id: 'user-a', email: 'qazuor+smoke2@gmail.com' },
                    { id: 'user-b', email: 'qazuor+turista@gmail.com' }
                ],
                [],
                [],
                [],
                []
            ],
            deleteResults: []
        });

        const result = await migration.up(buildCtx(probe.db));
        const counts = result.counts as Record<string, number>;

        expect(counts.usersResolved).toBe(2);
        expect(counts.usersProtectedAsInfrastructure).toBe(0);
    });

    it('is a no-op on a second run: nothing resolves, nothing is deleted', async () => {
        // Idempotence by construction — every step keys off a literal set, so a
        // re-run simply matches nothing.
        const probe = buildFakeDb({ selectResults: [[], [], [], [], []], deleteResults: [] });

        const result = await migration.up(buildCtx(probe.db));
        const counts = result.counts as Record<string, number>;

        expect(counts.usersResolved).toBe(0);
        expect(counts.usersDeleted).toBe(0);
        expect(counts.gastronomiesDeleted).toBe(0);
        expect(counts.experiencesDeleted).toBe(0);
        expect(counts.partnersDeleted).toBe(0);
        expect(counts.accommodationsDeleted).toBe(0);
    });

    it('reports every count the summary claims', async () => {
        const probe = buildFakeDb({
            selectResults: [
                [{ id: 'user-a', email: 'qazuor+smoke2@gmail.com' }],
                [{ id: 'gastro-1' }],
                [{ id: 'exp-1' }],
                [{ id: 'partner-1' }],
                [{ id: 'acc-1' }]
            ],
            deleteResults: []
        });

        const result = await migration.up(buildCtx(probe.db));
        const counts = result.counts as Record<string, number>;

        for (const key of [
            'usersResolved',
            'usersDeleted',
            'usersProtectedAsInfrastructure',
            'gastronomiesDeleted',
            'experiencesDeleted',
            'partnersDeleted',
            'accommodationsDeleted',
            'billingCustomersDeleted',
            'occupancyDeleted',
            'entityViewsDeleted',
            'entityCommentsDeleted',
            'accommodationReviewsDeleted',
            'destinationReviewsDeleted',
            'gastronomyReviewsDeleted',
            'experienceReviewsDeleted'
        ]) {
            expect(counts).toHaveProperty(key);
            expect(typeof counts[key]).toBe('number');
        }
    });
});
