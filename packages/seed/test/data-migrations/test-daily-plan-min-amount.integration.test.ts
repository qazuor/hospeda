/**
 * @fileoverview
 * Integration tests for `0005-test-daily-plan-min-amount.ts` (HOS-95).
 *
 * Runs against the REAL worktree PostgreSQL database, using the exact
 * rollback-isolation idiom established by
 * `test/data-migrations/billing-plans-port.integration.test.ts`: every test
 * opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside that transaction, then unconditionally throws a
 * sentinel `RollbackSignal` so the real `owner-test-daily` plan/price rows in
 * the shared worktree database are never actually mutated by this suite.
 *
 * Because `owner-test-daily` is a `required`-group row that may or may not
 * already exist on a given worktree/CI database (depending on whether
 * `0004-test-daily-plan` has been applied there), every test first drives the
 * plan/price rows to a known starting state (present-with-old-amount,
 * present-with-correct-amount, or absent) rather than assuming either state.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DAILY_PLAN, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { and, billingPlans, billingPrices, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as testDailyPlanMinAmount from '../../src/data-migrations/0005-test-daily-plan-min-amount.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as billing-plans-port.integration.test.ts:
// HOSPEDA_DATABASE_URL lives in apps/api/.env.local.
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
    id: 'actor-stub-hos95-test-daily-plan-min-amount',
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
 * Removes the `owner-test-daily` plan row and its daily price row (if
 * present), so a test can start from a known "plan does not exist" state
 * regardless of whether `0004-test-daily-plan` has already been applied to
 * this database. Deletes prices first to satisfy the `billing_prices.plan_id`
 * FK to `billing_plans.id`.
 */
async function removeTestDailyPlan(tx: DrizzleClient): Promise<void> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, TEST_DAILY_PLAN.slug))
        .limit(1);

    const planRow = existing[0];
    if (!planRow) {
        return;
    }

    await tx.delete(billingPrices).where(eq(billingPrices.planId, planRow.id));
    await tx.delete(billingPlans).where(eq(billingPlans.id, planRow.id));
}

/**
 * Ensures the `owner-test-daily` plan and its daily `billing_prices` row
 * exist with the given `unitAmount`, creating both from scratch if absent,
 * or updating the price row in place if already present. Returns the plan id.
 */
async function ensureTestDailyPlanAtAmount(tx: DrizzleClient, unitAmount: number): Promise<string> {
    const existingPlan = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, TEST_DAILY_PLAN.slug))
        .limit(1);

    let planId: string;
    const planRow = existingPlan[0];
    if (planRow) {
        planId = planRow.id;
    } else {
        const inserted = await tx
            .insert(billingPlans)
            .values({
                name: TEST_DAILY_PLAN.slug,
                description: TEST_DAILY_PLAN.description,
                active: TEST_DAILY_PLAN.isActive,
                entitlements: TEST_DAILY_PLAN.entitlements as string[],
                limits: {},
                livemode: true,
                displayName: TEST_DAILY_PLAN.name,
                monthlyPriceArs: TEST_DAILY_PLAN.monthlyPriceArs,
                annualPriceArs: TEST_DAILY_PLAN.annualPriceArs
            })
            .returning({ id: billingPlans.id });

        const insertedRow = inserted[0];
        if (!insertedRow) {
            throw new Error('Insert of test-fixture owner-test-daily plan returned no row');
        }
        planId = insertedRow.id;
    }

    const existingPrice = await tx
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'day'),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    const priceRow = existingPrice[0];
    if (priceRow) {
        await tx.update(billingPrices).set({ unitAmount }).where(eq(billingPrices.id, priceRow.id));
    } else {
        await tx.insert(billingPrices).values({
            planId,
            currency: 'ARS',
            unitAmount,
            billingInterval: 'day',
            intervalCount: 1,
            active: true,
            livemode: true
        });
    }

    return planId;
}

/** Reads back the daily test-plan price row's `unit_amount`, or `undefined` if no such row exists. */
async function readTestDailyPriceAmount(tx: DrizzleClient): Promise<number | undefined> {
    const existingPlan = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, TEST_DAILY_PLAN.slug))
        .limit(1);

    const planRow = existingPlan[0];
    if (!planRow) {
        return undefined;
    }

    const rows = await tx
        .select({ unitAmount: billingPrices.unitAmount })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'day'),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    return rows[0]?.unitAmount;
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

describe('0005-test-daily-plan-min-amount', () => {
    it('raises unit_amount from the old $1 ARS value to the MercadoPago $15 ARS minimum', async () => {
        await withRollback(async (tx) => {
            await ensureTestDailyPlanAtAmount(tx, 100);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await testDailyPlanMinAmount.up(ctx);

            expect(result.counts?.priceRowsUpdated).toBe(1);

            const amount = await readTestDailyPriceAmount(tx);
            expect(amount).toBe(TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS);
            expect(amount).toBe(1500);
        });
    });

    it('is idempotent: running up() again once already at 1500 updates zero rows', async () => {
        await withRollback(async (tx) => {
            await ensureTestDailyPlanAtAmount(tx, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await testDailyPlanMinAmount.up(ctx);
            expect(first.counts?.priceRowsUpdated).toBe(0);

            const second = await testDailyPlanMinAmount.up(ctx);
            expect(second.counts?.priceRowsUpdated).toBe(0);

            const amount = await readTestDailyPriceAmount(tx);
            expect(amount).toBe(TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS);
        });
    });

    it('is a no-op when the owner-test-daily plan does not exist yet on this environment', async () => {
        await withRollback(async (tx) => {
            await removeTestDailyPlan(tx);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await testDailyPlanMinAmount.up(ctx);

            expect(result.counts?.priceRowsUpdated).toBe(0);
            expect(result.summary).toContain('does not exist');
        });
    });
});
