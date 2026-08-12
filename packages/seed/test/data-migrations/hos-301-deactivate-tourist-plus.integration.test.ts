/**
 * @fileoverview
 * Integration tests for `0052-hos-301-deactivate-tourist-plus.ts` (HOS-301 D1).
 *
 * Modeled on `0003-hos16-deactivate-complex-plans.ts`'s own integration test
 * and `hos-301-tourist-trial-30-days.integration.test.ts` (the closest
 * sibling, migration 0051): runs against the REAL PostgreSQL database the
 * `packages/seed` integration `globalSetup` provisions
 * (`hospeda_seed_integration_test`), using the same rollback-isolation idiom
 * established by `test-daily-plan-min-amount.integration.test.ts`. Every test
 * opens a `db.transaction()`, drives the `billing_plans.active` column to a
 * known starting state, runs `up()`, asserts, then unconditionally throws a
 * sentinel `RollbackSignal` so nothing this suite writes survives past the
 * test that wrote it.
 *
 * `globalSetup` seeds `billing_plans` from `ALL_PLANS` — current branch state
 * already has `TOURIST_PLUS_PLAN.isActive = false` (this same PR's baseline
 * edit), so the `tourist-plus` row may already be inactive before any test
 * runs. Every test that wants to observe a true→false conversion must first
 * drive `active` back to `true` itself, exactly like the sibling 0051 suite
 * has to re-drive `trialDays` back to 14.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { billingPlans, type DrizzleClient, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as deactivateTouristPlus from '../../src/data-migrations/0052-hos-301-deactivate-tourist-plus.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as the sibling billing data-migration
// integration tests: HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/** Sentinel thrown at the end of every isolated test to force a rollback without surfacing as a real failure. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/** Stub actor — this migration only uses `ctx.db`, so a minimal stub suffices. */
const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos301-deactivate-tourist-plus',
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

/**
 * Ensures a `billing_plans` row exists for `slug` at exactly `active`,
 * updating it in place if the row already exists (as it will for
 * `tourist-plus`/`tourist-vip`/`owner-basico`, seeded by `globalSetup`) or
 * inserting a minimal fixture row otherwise. Returns the plan id.
 */
async function ensurePlanActiveFixture(
    tx: DrizzleClient,
    slug: string,
    active: boolean
): Promise<string> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const planRow = existing[0];
    if (planRow) {
        await tx.update(billingPlans).set({ active }).where(eq(billingPlans.id, planRow.id));
        return planRow.id;
    }

    const inserted = await tx
        .insert(billingPlans)
        .values({
            name: slug,
            description: `Test fixture plan for ${slug}`,
            active,
            entitlements: [],
            limits: {},
            livemode: true,
            displayName: slug,
            monthlyPriceArs: 500000,
            annualPriceArs: 5000000,
            metadata: { slug }
        })
        .returning({ id: billingPlans.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of test-fixture plan "${slug}" returned no row`);
    }
    return insertedRow.id;
}

/** Reads back a plan's `active` column. Returns `undefined` when the row does not exist. */
async function readPlanActive(tx: DrizzleClient, slug: string): Promise<boolean | undefined> {
    const rows = await tx
        .select({ active: billingPlans.active })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    return rows[0]?.active;
}

/**
 * Removes a plan's `billing_plans` row, so a test can start from a known
 * "plan does not exist" state. No-ops when absent.
 */
async function removePlanFixture(tx: DrizzleClient, slug: string): Promise<void> {
    await tx.delete(billingPlans).where(eq(billingPlans.name, slug));
}

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

describe('0052-hos-301-deactivate-tourist-plus', () => {
    it('deactivates an active tourist-plus row', async () => {
        await withRollback(async (tx) => {
            await ensurePlanActiveFixture(tx, 'tourist-plus', true);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await deactivateTouristPlus.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(1);
            expect(await readPlanActive(tx, 'tourist-plus')).toBe(false);
        });
    });

    it('is idempotent: a second up() updates zero rows and the row stays inactive', async () => {
        await withRollback(async (tx) => {
            await ensurePlanActiveFixture(tx, 'tourist-plus', true);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await deactivateTouristPlus.up(ctx);
            expect(first.counts?.planRowsUpdated).toBe(1);

            const second = await deactivateTouristPlus.up(ctx);
            expect(second.counts?.planRowsUpdated).toBe(0);

            expect(await readPlanActive(tx, 'tourist-plus')).toBe(false);
        });
    });

    it('leaves tourist-vip (and other plans) active — only tourist-plus is targeted', async () => {
        await withRollback(async (tx) => {
            await ensurePlanActiveFixture(tx, 'tourist-plus', true);
            await ensurePlanActiveFixture(tx, 'tourist-vip', true);
            await ensurePlanActiveFixture(tx, 'owner-basico', true);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await deactivateTouristPlus.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(1);
            expect(await readPlanActive(tx, 'tourist-plus')).toBe(false);
            expect(await readPlanActive(tx, 'tourist-vip')).toBe(true);
            expect(await readPlanActive(tx, 'owner-basico')).toBe(true);
        });
    });

    it('is a no-op when tourist-plus does not exist on this environment', async () => {
        await withRollback(async (tx) => {
            await removePlanFixture(tx, 'tourist-plus');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await deactivateTouristPlus.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(0);
            expect(result.summary).toContain('tourist-plus');
        });
    });
});
