/**
 * @fileoverview
 * Integration tests for the HOS-25 T-020 ported billing-plans data migrations:
 *
 * - `0001-billing-plans-ai-consumer-search-limits.ts`
 * - `0002-billing-plans-collections-limit.ts`
 * - `0003-hos16-deactivate-complex-plans.ts`
 *
 * Runs against the REAL worktree PostgreSQL database, mirroring the
 * bootstrap convention already established by
 * `test/data-migrations/safeDelete.test.ts` (T-007) and
 * `test/data-migrations/fkGuard.test.ts` (T-006): a minimal `pg` `Pool` +
 * `@repo/db`'s `initializeDb()`, loading `HOSPEDA_DATABASE_URL` from
 * `apps/api/.env.local`.
 *
 * ## Isolation from the shared `billing_plans` table
 *
 * These migrations `UPDATE` real `billing_plans` rows by `name` (the
 * accommodation plan slugs seeded by `packages/seed/src/required/billingPlans.seed.ts`).
 * To avoid leaving the shared worktree database mutated, every test:
 *
 * 1. Opens a `db.transaction()` and builds the migration's `ctx` with the
 *    TRANSACTION-SCOPED client (`ctx.db = tx`), exactly as the real runner
 *    (`runner.ts`, T-009) does.
 * 2. Performs all setup, the migration's `up()` call(s), and every assertion
 *    INSIDE that transaction.
 * 3. Unconditionally throws a sentinel `RollbackSignal` at the end of the
 *    callback (whether assertions passed or failed) so the transaction always
 *    rolls back — the real `billing_plans` rows are back to their pre-test
 *    state the instant the test function returns, regardless of outcome.
 *
 * This is the same rollback-isolation idiom `packages/db/test/integration/helpers.ts`
 * (`withTestTransaction`) uses for its own integration suite, adapted here
 * for `@repo/seed`'s existing `pg.Pool` + `initializeDb()` bootstrap instead
 * of that package's cached test-DB client (a cross-package import would pull
 * in `packages/db/test/`, which is not part of `@repo/db`'s public surface).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { billingPlans, eq, getDb, initializeDb, resetDb, sql } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as aiConsumerSearchLimits from '../../src/data-migrations/0001-billing-plans-ai-consumer-search-limits.js';
import * as collectionsLimit from '../../src/data-migrations/0002-billing-plans-collections-limit.js';
import * as deactivateComplexPlans from '../../src/data-migrations/0003-hos16-deactivate-complex-plans.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as packages/seed/src/index.ts and
// test/data-migrations/safeDelete.test.ts: HOSPEDA_DATABASE_URL lives in
// apps/api/.env.local, not in a (nonexistent) packages/seed env file.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback without surfacing as a real failure. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/** Stub actor — none of these migrations use `ctx.services`/`ctx.actor`, only `ctx.db`, so a minimal stub suffices. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos25-t020',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/**
 * Runs `fn` inside a transaction that ALWAYS rolls back, regardless of
 * whether `fn` throws. `fn` receives the transaction-scoped Drizzle client —
 * pass it as `ctx.db` when building a migration context, exactly like the
 * real runner does.
 */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            // `tx`'s Drizzle-inferred transaction type is a structural subtype of
            // `DrizzleClient` (see packages/db/src/types.ts's `DrizzleClient` JSDoc)
            // — the real runner (runner.ts) passes it to `buildMigrationContext`
            // the same way, with no cast.
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
        throw error;
    }
}

/** Row shape read back for assertions. */
interface PlanRow {
    readonly name: string;
    readonly limits: Record<string, number>;
    readonly entitlements: string[];
    readonly active: boolean;
}

async function readPlan(tx: DrizzleClient, name: string): Promise<PlanRow> {
    const rows = await tx
        .select({
            name: billingPlans.name,
            limits: billingPlans.limits,
            entitlements: billingPlans.entitlements,
            active: billingPlans.active
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, name))
        .limit(1);

    const row = rows[0];
    if (!row) {
        throw new Error(
            `Test fixture assumption broken: no billing_plans row named "${name}" — is the required seed (packages/seed/src/required/billingPlans.seed.ts) applied to this worktree DB?`
        );
    }
    return {
        name: row.name,
        limits: (row.limits ?? {}) as Record<string, number>,
        entitlements: (row.entitlements ?? []) as string[],
        active: row.active ?? false
    };
}

/** Removes the given keys from `limits` (jsonb `-` operator) for one plan, so the test controls the starting state. */
async function stripLimitKeys(
    tx: DrizzleClient,
    name: string,
    keys: readonly string[]
): Promise<void> {
    for (const key of keys) {
        await tx.execute(sql`
            UPDATE billing_plans SET limits = limits - ${key} WHERE name = ${name}
        `);
    }
}

/** Removes an entitlement from `entitlements` (array_remove) for one plan, so the test controls the starting state. */
async function stripEntitlement(
    tx: DrizzleClient,
    name: string,
    entitlement: string
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    entitlements = array_remove(entitlements, ${entitlement})
        WHERE  name = ${name}
    `);
}

/** Directly sets a single limits key to an arbitrary value, simulating an operator edit made via the admin UI. */
async function setLimitKey(
    tx: DrizzleClient,
    name: string,
    key: string,
    value: number
): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans
        SET    limits = limits || jsonb_build_object(${key}::text, ${value}::int)
        WHERE  name = ${name}
    `);
}

/** Sets `active` to an arbitrary boolean, simulating an operator edit made via the admin UI. */
async function setActive(tx: DrizzleClient, name: string, active: boolean): Promise<void> {
    await tx.execute(sql`
        UPDATE billing_plans SET active = ${active} WHERE name = ${name}
    `);
}

const ALL_NINE_ACCOMMODATION_PLANS = [
    'tourist-free',
    'tourist-plus',
    'tourist-vip',
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

const ALL_EIGHT_ENTITLED_PLANS = [
    'tourist-plus',
    'tourist-vip',
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

let pool: Pool;

beforeAll(() => {
    if (!process.env.HOSPEDA_DATABASE_URL) {
        throw new Error(
            'HOSPEDA_DATABASE_URL is not set — is apps/api/.env.local present in this worktree?'
        );
    }

    pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
    resetDb();
    initializeDb(pool);
});

afterAll(async () => {
    await pool.end();
    resetDb();
});

describe('0001-billing-plans-ai-consumer-search-limits', () => {
    it('adds both limit keys with the documented per-plan values when missing', async () => {
        await withRollback(async (tx) => {
            for (const name of ALL_NINE_ACCOMMODATION_PLANS) {
                await stripLimitKeys(tx, name, [
                    'max_ai_search_per_month',
                    'max_ai_chat_consumer_per_month'
                ]);
            }

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await aiConsumerSearchLimits.up(ctx);

            expect(result.counts?.searchLimitRowsUpdated).toBe(9);
            expect(result.counts?.chatLimitRowsUpdated).toBe(9);

            const touristFree = await readPlan(tx, 'tourist-free');
            expect(touristFree.limits.max_ai_search_per_month).toBe(10);
            expect(touristFree.limits.max_ai_chat_consumer_per_month).toBe(10);

            const touristPlus = await readPlan(tx, 'tourist-plus');
            expect(touristPlus.limits.max_ai_search_per_month).toBe(50);
            expect(touristPlus.limits.max_ai_chat_consumer_per_month).toBe(50);

            for (const name of [
                'tourist-vip',
                'owner-basico',
                'owner-pro',
                'owner-premium',
                'complex-basico',
                'complex-pro',
                'complex-premium'
            ] as const) {
                const plan = await readPlan(tx, name);
                expect(plan.limits.max_ai_search_per_month).toBe(200);
                expect(plan.limits.max_ai_chat_consumer_per_month).toBe(200);
            }
        });
    });

    it('is idempotent: running up() again once both keys are present updates zero rows', async () => {
        await withRollback(async (tx) => {
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // First run establishes the keys (starting state may already have
            // them from a prior real seed/extras run on this worktree DB —
            // that is fine, it only makes this first call itself a no-op too).
            await aiConsumerSearchLimits.up(ctx);

            const second = await aiConsumerSearchLimits.up(ctx);
            expect(second.counts?.searchLimitRowsUpdated).toBe(0);
            expect(second.counts?.chatLimitRowsUpdated).toBe(0);
        });
    });

    it('never overwrites an operator-edited limit value (OR-PRESERVE)', async () => {
        await withRollback(async (tx) => {
            await stripLimitKeys(tx, 'tourist-plus', ['max_ai_search_per_month']);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // First run adds the documented default (50).
            await aiConsumerSearchLimits.up(ctx);
            const afterFirstRun = await readPlan(tx, 'tourist-plus');
            expect(afterFirstRun.limits.max_ai_search_per_month).toBe(50);

            // Operator manually edits it via the admin UI to a custom value.
            await setLimitKey(tx, 'tourist-plus', 'max_ai_search_per_month', 999);

            // Re-running the migration must NOT clobber the operator's edit.
            const second = await aiConsumerSearchLimits.up(ctx);
            expect(second.counts?.searchLimitRowsUpdated).toBe(0);

            const afterSecondRun = await readPlan(tx, 'tourist-plus');
            expect(afterSecondRun.limits.max_ai_search_per_month).toBe(999);
        });
    });
});

describe('0002-billing-plans-collections-limit', () => {
    it('appends can_use_collections and sets max_collections with the documented per-plan values when missing', async () => {
        await withRollback(async (tx) => {
            for (const name of ALL_EIGHT_ENTITLED_PLANS) {
                await stripEntitlement(tx, name, 'can_use_collections');
                await stripLimitKeys(tx, name, ['max_collections']);
            }

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await collectionsLimit.up(ctx);

            expect(result.counts?.entitlementRowsUpdated).toBe(8);
            expect(result.counts?.limitRowsUpdated).toBe(8);

            const touristPlus = await readPlan(tx, 'tourist-plus');
            expect(touristPlus.entitlements).toContain('can_use_collections');
            expect(touristPlus.limits.max_collections).toBe(10);

            for (const name of [
                'tourist-vip',
                'owner-basico',
                'owner-pro',
                'owner-premium',
                'complex-basico',
                'complex-pro',
                'complex-premium'
            ] as const) {
                const plan = await readPlan(tx, name);
                expect(plan.entitlements).toContain('can_use_collections');
                expect(plan.limits.max_collections).toBe(25);
            }

            // tourist-free never gets the entitlement (excluded by design).
            const touristFree = await readPlan(tx, 'tourist-free');
            expect(touristFree.entitlements).not.toContain('can_use_collections');
        });
    });

    it('is idempotent: running up() again once both facets are present updates zero rows', async () => {
        await withRollback(async (tx) => {
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            await collectionsLimit.up(ctx);

            const second = await collectionsLimit.up(ctx);
            expect(second.counts?.entitlementRowsUpdated).toBe(0);
            expect(second.counts?.limitRowsUpdated).toBe(0);
        });
    });

    it('never overwrites an operator-edited max_collections value (OR-PRESERVE)', async () => {
        await withRollback(async (tx) => {
            await stripLimitKeys(tx, 'tourist-vip', ['max_collections']);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            // First run adds the documented default (25).
            await collectionsLimit.up(ctx);
            const afterFirstRun = await readPlan(tx, 'tourist-vip');
            expect(afterFirstRun.limits.max_collections).toBe(25);

            // Operator manually edits it via the admin UI to a custom value.
            await setLimitKey(tx, 'tourist-vip', 'max_collections', 777);

            const second = await collectionsLimit.up(ctx);
            expect(second.counts?.limitRowsUpdated).toBe(0);

            const afterSecondRun = await readPlan(tx, 'tourist-vip');
            expect(afterSecondRun.limits.max_collections).toBe(777);
        });
    });
});

describe('0003-hos16-deactivate-complex-plans', () => {
    const COMPLEX_PLANS = ['complex-basico', 'complex-pro', 'complex-premium'] as const;

    it('deactivates all 3 complex plans when currently active', async () => {
        await withRollback(async (tx) => {
            for (const name of COMPLEX_PLANS) {
                await setActive(tx, name, true);
            }

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await deactivateComplexPlans.up(ctx);

            expect(result.counts?.deactivatedRows).toBe(3);

            for (const name of COMPLEX_PLANS) {
                const plan = await readPlan(tx, name);
                expect(plan.active).toBe(false);
            }
        });
    });

    it('is idempotent: running up() again once all 3 are inactive updates zero rows', async () => {
        await withRollback(async (tx) => {
            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            await deactivateComplexPlans.up(ctx);

            const second = await deactivateComplexPlans.up(ctx);
            expect(second.counts?.deactivatedRows).toBe(0);
        });
    });
});
