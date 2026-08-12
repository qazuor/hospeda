/**
 * @fileoverview
 * Integration tests for `0049-hos-301-reprice-owner-plans.ts` (HOS-301 D1).
 *
 * Modeled directly on
 * `raise-commerce-listing-price-to-15000.integration.test.ts`: runs against
 * the REAL worktree PostgreSQL database, using the same rollback-isolation
 * idiom established by `test-daily-plan-min-amount.integration.test.ts`.
 * Every test opens a `db.transaction()`, builds the migration's `ctx` with
 * the transaction-scoped client (`ctx.db = tx`), performs setup + `up()` +
 * assertions entirely inside that transaction, then unconditionally throws a
 * sentinel `RollbackSignal` so the real `owner-basico`/`owner-premium`/
 * `owner-pro` plan/price rows in the shared worktree database are never
 * actually mutated by this suite.
 *
 * Because these are `required`-group rows that may already exist on a given
 * worktree/CI database (and, since this same branch's PR also edited
 * `plans.config.ts` to the NEW HOS-301 amounts, a fresh `db:fresh-dev` seed
 * — or this suite's own integration `globalSetup`, which seeds `ALL_PLANS`
 * — would insert them ALREADY at the new prices), every test explicitly
 * drives the plan/price rows to a known starting state (old-placeholder,
 * already-converged, operator-overridden, or absent) inside its own
 * transaction rather than assuming any particular state.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { and, billingPlans, billingPrices, eq, getDb, initializeDb, resetDb } from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as repriceOwnerPlans from '../../src/data-migrations/0049-hos-301-reprice-owner-plans.js';
import { buildMigrationContext } from '../../src/data-migrations/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same env-loading convention as raise-commerce-listing-price-to-15000.integration.test.ts:
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
    id: 'actor-stub-hos301-reprice-owner-plans',
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

/** The HOS-301 D1 old→new grid this suite exercises, for `owner-basico`. */
const BASICO_OLD_MONTHLY = 1500000;
const BASICO_NEW_MONTHLY = 1800000;
const BASICO_OLD_ANNUAL = 15000000;
const BASICO_NEW_ANNUAL = 18000000;
const BASICO_OLD_USD_REF = 15;
const BASICO_NEW_USD_REF = 18;

/** The HOS-301 D1 old→new grid this suite exercises, for `owner-premium`. */
const PREMIUM_OLD_MONTHLY = 7500000;
const PREMIUM_NEW_MONTHLY = 6500000;
const PREMIUM_OLD_ANNUAL = 75000000;
const PREMIUM_NEW_ANNUAL = 65000000;
const PREMIUM_OLD_USD_REF = 75;
const PREMIUM_NEW_USD_REF = 65;

/** `owner-pro`'s amounts — D1 confirmed these unchanged, so the migration must never touch them. */
const PRO_MONTHLY = 3500000;
const PRO_ANNUAL = 35000000;
const PRO_USD_REF = 35;

/**
 * Inputs for {@link ensureOwnerPlanFixture}: a plan's slug, its typed-column
 * ARS amounts, and the full metadata object to write (so a test can shape
 * both the JSONB mirror and any unrelated sub-fields it wants to assert
 * survive a merge).
 */
interface OwnerPlanFixtureInput {
    readonly slug: string;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number;
    readonly metadata: Record<string, unknown>;
}

/** Snapshot of one owner plan's typed columns, metadata, and both price rows. */
interface OwnerPlanFixtureState {
    readonly monthlyPriceArs: number | undefined;
    readonly annualPriceArs: number | undefined;
    readonly metadata: Record<string, unknown>;
    readonly monthlyUnitAmount: number | undefined;
    readonly annualUnitAmount: number | undefined;
}

/**
 * Ensures the active ARS `billing_prices` row for one `(planId,
 * billingInterval)` pair exists at `unitAmount`, updating it in place if
 * already present or creating it otherwise.
 */
async function ensurePriceRow(
    tx: DrizzleClient,
    planId: string,
    billingInterval: 'month' | 'year',
    unitAmount: number
): Promise<void> {
    const existing = await tx
        .select({ id: billingPrices.id })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    const priceRow = existing[0];
    if (priceRow) {
        await tx.update(billingPrices).set({ unitAmount }).where(eq(billingPrices.id, priceRow.id));
    } else {
        await tx.insert(billingPrices).values({
            planId,
            currency: 'ARS',
            unitAmount,
            billingInterval,
            intervalCount: 1,
            active: true,
            livemode: true
        });
    }
}

/**
 * Drives one owner plan's `billing_plans` row (typed columns + metadata) and
 * its monthly/annual `billing_prices` rows to the exact state described by
 * `input`, creating them from scratch if absent or updating them in place if
 * already present. Returns the plan id.
 */
async function ensureOwnerPlanFixture(
    tx: DrizzleClient,
    input: OwnerPlanFixtureInput
): Promise<string> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, input.slug))
        .limit(1);

    let planId: string;
    const planRow = existing[0];
    if (planRow) {
        planId = planRow.id;
        await tx
            .update(billingPlans)
            .set({
                monthlyPriceArs: input.monthlyPriceArs,
                annualPriceArs: input.annualPriceArs,
                metadata: input.metadata
            })
            .where(eq(billingPlans.id, planId));
    } else {
        const inserted = await tx
            .insert(billingPlans)
            .values({
                name: input.slug,
                description: `Test fixture plan for ${input.slug}`,
                active: true,
                entitlements: [],
                limits: {},
                livemode: true,
                displayName: (input.metadata.displayName as string | undefined) ?? input.slug,
                monthlyPriceArs: input.monthlyPriceArs,
                annualPriceArs: input.annualPriceArs,
                metadata: input.metadata
            })
            .returning({ id: billingPlans.id });

        const insertedRow = inserted[0];
        if (!insertedRow) {
            throw new Error(`Insert of test-fixture plan "${input.slug}" returned no row`);
        }
        planId = insertedRow.id;
    }

    await ensurePriceRow(tx, planId, 'month', input.monthlyPriceArs);
    await ensurePriceRow(tx, planId, 'year', input.annualPriceArs);

    return planId;
}

/**
 * Removes an owner plan's `billing_plans` row and its `billing_prices` rows
 * (if present), so a test can start from a known "plan does not exist"
 * state. Deletes prices first to satisfy the `billing_prices.plan_id` FK to
 * `billing_plans.id`.
 */
async function removeOwnerPlanFixture(tx: DrizzleClient, slug: string): Promise<void> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const planRow = existing[0];
    if (!planRow) {
        return;
    }

    await tx.delete(billingPrices).where(eq(billingPrices.planId, planRow.id));
    await tx.delete(billingPlans).where(eq(billingPlans.id, planRow.id));
}

/**
 * Reads back one owner plan's typed columns, metadata, and monthly/annual
 * `billing_prices.unitAmount` values. Returns `undefined` when the plan row
 * does not exist.
 */
async function readOwnerPlanFixture(
    tx: DrizzleClient,
    slug: string
): Promise<OwnerPlanFixtureState | undefined> {
    const existing = await tx
        .select({
            id: billingPlans.id,
            monthlyPriceArs: billingPlans.monthlyPriceArs,
            annualPriceArs: billingPlans.annualPriceArs,
            metadata: billingPlans.metadata
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const planRow = existing[0];
    if (!planRow) {
        return undefined;
    }

    const prices = await tx
        .select({
            billingInterval: billingPrices.billingInterval,
            unitAmount: billingPrices.unitAmount
        })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.intervalCount, 1)
            )
        );

    return {
        monthlyPriceArs: planRow.monthlyPriceArs ?? undefined,
        annualPriceArs: planRow.annualPriceArs ?? undefined,
        metadata: (planRow.metadata ?? {}) as Record<string, unknown>,
        monthlyUnitAmount: prices.find((p) => p.billingInterval === 'month')?.unitAmount,
        annualUnitAmount: prices.find((p) => p.billingInterval === 'year')?.unitAmount
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

describe('0049-hos-301-reprice-owner-plans', () => {
    it('converges all three carriers for both owner-basico and owner-premium from the old amounts', async () => {
        await withRollback(async (tx) => {
            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-basico',
                monthlyPriceArs: BASICO_OLD_MONTHLY,
                annualPriceArs: BASICO_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-basico',
                    displayName: 'Basic',
                    category: 'owner',
                    monthlyPriceArs: BASICO_OLD_MONTHLY,
                    annualPriceArs: BASICO_OLD_ANNUAL,
                    monthlyPriceUsdRef: BASICO_OLD_USD_REF
                }
            });
            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-premium',
                monthlyPriceArs: PREMIUM_OLD_MONTHLY,
                annualPriceArs: PREMIUM_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-premium',
                    displayName: 'Premium',
                    category: 'owner',
                    monthlyPriceArs: PREMIUM_OLD_MONTHLY,
                    annualPriceArs: PREMIUM_OLD_ANNUAL,
                    monthlyPriceUsdRef: PREMIUM_OLD_USD_REF
                }
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceOwnerPlans.up(ctx);

            expect(result.counts?.plansUpdated).toBe(2);
            expect(result.counts?.metadataUpdated).toBe(2);
            expect(result.counts?.priceRowsUpdated).toBe(4);
            expect(result.counts?.plansSkipped).toBe(0);

            const basico = await readOwnerPlanFixture(tx, 'owner-basico');
            expect(basico?.monthlyPriceArs).toBe(BASICO_NEW_MONTHLY);
            expect(basico?.annualPriceArs).toBe(BASICO_NEW_ANNUAL);
            expect(basico?.metadata.monthlyPriceArs).toBe(BASICO_NEW_MONTHLY);
            expect(basico?.metadata.annualPriceArs).toBe(BASICO_NEW_ANNUAL);
            expect(basico?.metadata.monthlyPriceUsdRef).toBe(BASICO_NEW_USD_REF);
            expect(basico?.monthlyUnitAmount).toBe(BASICO_NEW_MONTHLY);
            expect(basico?.annualUnitAmount).toBe(BASICO_NEW_ANNUAL);

            const premium = await readOwnerPlanFixture(tx, 'owner-premium');
            expect(premium?.monthlyPriceArs).toBe(PREMIUM_NEW_MONTHLY);
            expect(premium?.annualPriceArs).toBe(PREMIUM_NEW_ANNUAL);
            expect(premium?.metadata.monthlyPriceArs).toBe(PREMIUM_NEW_MONTHLY);
            expect(premium?.metadata.annualPriceArs).toBe(PREMIUM_NEW_ANNUAL);
            expect(premium?.metadata.monthlyPriceUsdRef).toBe(PREMIUM_NEW_USD_REF);
            expect(premium?.monthlyUnitAmount).toBe(PREMIUM_NEW_MONTHLY);
            expect(premium?.annualUnitAmount).toBe(PREMIUM_NEW_ANNUAL);
        });
    });

    it('is idempotent: a second up() updates zero rows across every counter', async () => {
        await withRollback(async (tx) => {
            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-basico',
                monthlyPriceArs: BASICO_OLD_MONTHLY,
                annualPriceArs: BASICO_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-basico',
                    monthlyPriceArs: BASICO_OLD_MONTHLY,
                    annualPriceArs: BASICO_OLD_ANNUAL,
                    monthlyPriceUsdRef: BASICO_OLD_USD_REF
                }
            });
            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-premium',
                monthlyPriceArs: PREMIUM_OLD_MONTHLY,
                annualPriceArs: PREMIUM_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-premium',
                    monthlyPriceArs: PREMIUM_OLD_MONTHLY,
                    annualPriceArs: PREMIUM_OLD_ANNUAL,
                    monthlyPriceUsdRef: PREMIUM_OLD_USD_REF
                }
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await repriceOwnerPlans.up(ctx);
            expect(first.counts?.plansUpdated).toBe(2);
            expect(first.counts?.metadataUpdated).toBe(2);
            expect(first.counts?.priceRowsUpdated).toBe(4);

            const second = await repriceOwnerPlans.up(ctx);
            expect(second.counts?.plansUpdated).toBe(0);
            expect(second.counts?.metadataUpdated).toBe(0);
            expect(second.counts?.priceRowsUpdated).toBe(0);
            expect(second.counts?.plansSkipped).toBe(0);

            const basico = await readOwnerPlanFixture(tx, 'owner-basico');
            expect(basico?.monthlyPriceArs).toBe(BASICO_NEW_MONTHLY);
            expect(basico?.annualPriceArs).toBe(BASICO_NEW_ANNUAL);

            const premium = await readOwnerPlanFixture(tx, 'owner-premium');
            expect(premium?.monthlyPriceArs).toBe(PREMIUM_NEW_MONTHLY);
            expect(premium?.annualPriceArs).toBe(PREMIUM_NEW_ANNUAL);
        });
    });

    it('preserves an operator-overridden field per carrier while still converging the rest', async () => {
        await withRollback(async (tx) => {
            // owner-basico: an operator already set the monthly price (typed
            // column + metadata mirror + monthly billing_prices row) via the
            // SPEC-168 admin UI to 1650000 — none of the three carriers equal
            // the old 1500000 placeholder anymore, so the guard must leave all
            // three untouched. The annual amount and the USD reference are
            // still at the old value, so those DO converge.
            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-basico',
                monthlyPriceArs: 1650000,
                annualPriceArs: BASICO_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-basico',
                    monthlyPriceArs: 1650000,
                    annualPriceArs: BASICO_OLD_ANNUAL,
                    monthlyPriceUsdRef: BASICO_OLD_USD_REF
                }
            });
            await removeOwnerPlanFixture(tx, 'owner-premium');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceOwnerPlans.up(ctx);

            expect(result.counts?.plansUpdated).toBe(1);
            expect(result.counts?.metadataUpdated).toBe(1);
            expect(result.counts?.priceRowsUpdated).toBe(1);
            expect(result.counts?.plansSkipped).toBe(1);

            const basico = await readOwnerPlanFixture(tx, 'owner-basico');
            // Operator-overridden monthly amount: untouched on every carrier.
            expect(basico?.monthlyPriceArs).toBe(1650000);
            expect(basico?.metadata.monthlyPriceArs).toBe(1650000);
            expect(basico?.monthlyUnitAmount).toBe(1650000);
            // Still-old annual amount + USD ref: converged to the new values.
            expect(basico?.annualPriceArs).toBe(BASICO_NEW_ANNUAL);
            expect(basico?.metadata.annualPriceArs).toBe(BASICO_NEW_ANNUAL);
            expect(basico?.metadata.monthlyPriceUsdRef).toBe(BASICO_NEW_USD_REF);
            expect(basico?.annualUnitAmount).toBe(BASICO_NEW_ANNUAL);
        });
    });

    it('is a no-op when neither owner-basico nor owner-premium exists yet on this environment', async () => {
        await withRollback(async (tx) => {
            await removeOwnerPlanFixture(tx, 'owner-basico');
            await removeOwnerPlanFixture(tx, 'owner-premium');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceOwnerPlans.up(ctx);

            expect(result.counts?.plansUpdated).toBe(0);
            expect(result.counts?.metadataUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);
            expect(result.counts?.plansSkipped).toBe(2);
            expect(result.summary).toContain('owner-basico');
            expect(result.summary).toContain('owner-premium');
        });
    });

    it('leaves owner-pro completely unchanged — it is outside the HOS-301 D1 repricing grid', async () => {
        await withRollback(async (tx) => {
            await removeOwnerPlanFixture(tx, 'owner-basico');
            await removeOwnerPlanFixture(tx, 'owner-premium');

            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-pro',
                monthlyPriceArs: PRO_MONTHLY,
                annualPriceArs: PRO_ANNUAL,
                metadata: {
                    slug: 'owner-pro',
                    displayName: 'Professional',
                    category: 'owner',
                    monthlyPriceArs: PRO_MONTHLY,
                    annualPriceArs: PRO_ANNUAL,
                    monthlyPriceUsdRef: PRO_USD_REF
                }
            });

            const before = await readOwnerPlanFixture(tx, 'owner-pro');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await repriceOwnerPlans.up(ctx);

            expect(result.counts?.plansUpdated).toBe(0);
            expect(result.counts?.metadataUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);

            const after = await readOwnerPlanFixture(tx, 'owner-pro');
            expect(after).toEqual(before);
        });
    });

    it('merges the metadata update onto existing metadata, preserving unrelated sub-fields', async () => {
        await withRollback(async (tx) => {
            await removeOwnerPlanFixture(tx, 'owner-premium');

            await ensureOwnerPlanFixture(tx, {
                slug: 'owner-basico',
                monthlyPriceArs: BASICO_OLD_MONTHLY,
                annualPriceArs: BASICO_OLD_ANNUAL,
                metadata: {
                    slug: 'owner-basico',
                    displayName: 'Basic Test Fixture',
                    category: 'owner',
                    isDefault: true,
                    sortOrder: 1,
                    monthlyPriceArs: BASICO_OLD_MONTHLY,
                    annualPriceArs: BASICO_OLD_ANNUAL,
                    monthlyPriceUsdRef: BASICO_OLD_USD_REF
                }
            });

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await repriceOwnerPlans.up(ctx);

            const basico = await readOwnerPlanFixture(tx, 'owner-basico');
            // Unrelated sub-fields survive the merge untouched.
            expect(basico?.metadata.displayName).toBe('Basic Test Fixture');
            expect(basico?.metadata.category).toBe('owner');
            expect(basico?.metadata.isDefault).toBe(true);
            expect(basico?.metadata.sortOrder).toBe(1);
            // Price-related sub-fields converged.
            expect(basico?.metadata.monthlyPriceArs).toBe(BASICO_NEW_MONTHLY);
            expect(basico?.metadata.annualPriceArs).toBe(BASICO_NEW_ANNUAL);
            expect(basico?.metadata.monthlyPriceUsdRef).toBe(BASICO_NEW_USD_REF);
        });
    });
});
