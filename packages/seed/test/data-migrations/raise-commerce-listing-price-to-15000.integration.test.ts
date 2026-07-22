/**
 * @fileoverview
 * Integration tests for `0022-raise-commerce-listing-price-to-15000.ts` (HOS-166).
 *
 * Runs against the REAL worktree PostgreSQL database, using the exact
 * rollback-isolation idiom established by
 * `test/data-migrations/test-daily-plan-min-amount.integration.test.ts`: every
 * test opens a `db.transaction()`, builds the migration's `ctx` with the
 * transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside that transaction, then unconditionally throws a
 * sentinel `RollbackSignal` so the real `commerce-listing` plan/price rows in
 * the shared worktree database are never actually mutated by this suite.
 *
 * Because `commerce-listing` is a `required`-group row that may or may not
 * already exist on a given worktree/CI database at the migration's target
 * price, every test first drives the plan/price rows to a known starting
 * state (old-placeholder, already-converged, operator-overridden, or absent)
 * rather than assuming any particular state.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMERCE_LISTING_PLAN } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { and, billingPlans, billingPrices, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as raiseCommerceListingPrice from '../../src/data-migrations/0022-raise-commerce-listing-price-to-15000.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as test-daily-plan-min-amount.integration.test.ts:
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
    id: 'actor-stub-hos166-raise-commerce-listing-price',
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
 * Removes the `commerce-listing` plan row and its monthly price row (if
 * present), so a test can start from a known "plan does not exist" state.
 * Deletes prices first to satisfy the `billing_prices.plan_id` FK to
 * `billing_plans.id`.
 */
async function removeCommerceListingPlan(tx: DrizzleClient): Promise<void> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, COMMERCE_LISTING_PLAN.slug))
        .limit(1);

    const planRow = existing[0];
    if (!planRow) {
        return;
    }

    await tx.delete(billingPrices).where(eq(billingPrices.planId, planRow.id));
    await tx.delete(billingPlans).where(eq(billingPlans.id, planRow.id));
}

/**
 * Ensures the `commerce-listing` plan and its monthly `billing_prices` row
 * exist with the given `amount` on BOTH `billing_plans.monthlyPriceArs` and
 * `billing_prices.unitAmount`, creating both from scratch if absent, or
 * updating them in place if already present. Returns the plan id.
 */
async function ensureCommerceListingPlanAtAmount(
    tx: DrizzleClient,
    amount: number
): Promise<string> {
    const existingPlan = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, COMMERCE_LISTING_PLAN.slug))
        .limit(1);

    let planId: string;
    const planRow = existingPlan[0];
    if (planRow) {
        planId = planRow.id;
        await tx
            .update(billingPlans)
            .set({ monthlyPriceArs: amount })
            .where(eq(billingPlans.id, planId));
    } else {
        const inserted = await tx
            .insert(billingPlans)
            .values({
                name: COMMERCE_LISTING_PLAN.slug,
                description: COMMERCE_LISTING_PLAN.description,
                active: COMMERCE_LISTING_PLAN.isActive,
                entitlements: COMMERCE_LISTING_PLAN.entitlements as string[],
                limits: {},
                livemode: true,
                displayName: COMMERCE_LISTING_PLAN.name,
                monthlyPriceArs: amount,
                annualPriceArs: COMMERCE_LISTING_PLAN.annualPriceArs
            })
            .returning({ id: billingPlans.id });

        const insertedRow = inserted[0];
        if (!insertedRow) {
            throw new Error('Insert of test-fixture commerce-listing plan returned no row');
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
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    const priceRow = existingPrice[0];
    if (priceRow) {
        await tx
            .update(billingPrices)
            .set({ unitAmount: amount })
            .where(eq(billingPrices.id, priceRow.id));
    } else {
        await tx.insert(billingPrices).values({
            planId,
            currency: 'ARS',
            unitAmount: amount,
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            livemode: true
        });
    }

    return planId;
}

/** Reads back the commerce-listing plan's `monthlyPriceArs` and its monthly price row's `unitAmount`. */
async function readCommerceListingAmounts(
    tx: DrizzleClient
): Promise<{ monthlyPriceArs: number | undefined; unitAmount: number | undefined }> {
    const existingPlan = await tx
        .select({ id: billingPlans.id, monthlyPriceArs: billingPlans.monthlyPriceArs })
        .from(billingPlans)
        .where(eq(billingPlans.name, COMMERCE_LISTING_PLAN.slug))
        .limit(1);

    const planRow = existingPlan[0];
    if (!planRow) {
        return { monthlyPriceArs: undefined, unitAmount: undefined };
    }

    const rows = await tx
        .select({ unitAmount: billingPrices.unitAmount })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    return {
        monthlyPriceArs: planRow.monthlyPriceArs ?? undefined,
        unitAmount: rows[0]?.unitAmount
    };
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

describe('0022-raise-commerce-listing-price-to-15000', () => {
    it('raises the commerce-listing plan/price from the old $5.000 ARS placeholder to $15.000 ARS', async () => {
        await withRollback(async (tx) => {
            await ensureCommerceListingPlanAtAmount(tx, 500000);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await raiseCommerceListingPrice.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(1);
            expect(result.counts?.priceRowsUpdated).toBe(1);

            const { monthlyPriceArs, unitAmount } = await readCommerceListingAmounts(tx);
            expect(monthlyPriceArs).toBe(1500000);
            expect(unitAmount).toBe(1500000);
        });
    });

    it('is idempotent: running up() again once already at 1500000 updates zero rows', async () => {
        await withRollback(async (tx) => {
            await ensureCommerceListingPlanAtAmount(tx, 1500000);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await raiseCommerceListingPrice.up(ctx);
            expect(first.counts?.planRowsUpdated).toBe(0);
            expect(first.counts?.priceRowsUpdated).toBe(0);

            const second = await raiseCommerceListingPrice.up(ctx);
            expect(second.counts?.planRowsUpdated).toBe(0);
            expect(second.counts?.priceRowsUpdated).toBe(0);

            const { monthlyPriceArs, unitAmount } = await readCommerceListingAmounts(tx);
            expect(monthlyPriceArs).toBe(1500000);
            expect(unitAmount).toBe(1500000);
        });
    });

    it('preserves an operator-overridden price: up() leaves a non-placeholder value untouched', async () => {
        await withRollback(async (tx) => {
            await ensureCommerceListingPlanAtAmount(tx, 2000000);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await raiseCommerceListingPrice.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);

            const { monthlyPriceArs, unitAmount } = await readCommerceListingAmounts(tx);
            expect(monthlyPriceArs).toBe(2000000);
            expect(unitAmount).toBe(2000000);
        });
    });

    it('is a no-op when the commerce-listing plan does not exist yet on this environment', async () => {
        await withRollback(async (tx) => {
            await removeCommerceListingPlan(tx);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await raiseCommerceListingPrice.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);
            expect(result.summary).toContain('does not exist');
        });
    });
});
