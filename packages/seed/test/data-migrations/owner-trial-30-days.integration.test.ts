/**
 * @fileoverview
 * Integration tests for `0055-owner-trial-30-days.ts` (owner decision,
 * 2026-08-15).
 *
 * Modeled on `hos-301-tourist-trial-30-days.integration.test.ts`: runs
 * against the REAL PostgreSQL database the `packages/seed` integration
 * `globalSetup` provisions (`hospeda_seed_integration_test`), using the same
 * rollback-isolation idiom established by
 * `test-daily-plan-min-amount.integration.test.ts`. Every test opens a
 * `db.transaction()`, drives the `billing_plans` / `billing_prices` rows to a
 * known starting state, runs `up()`, asserts, then unconditionally throws a
 * sentinel `RollbackSignal` so nothing this suite writes survives past the
 * test that wrote it.
 *
 * Two things make explicit state-seeding mandatory here rather than optional:
 *
 * 1. `globalSetup` seeds `billing_plans` from `ALL_PLANS` (current branch
 *    state: `OWNER_TRIAL_DAYS = 30` already, per
 *    `packages/billing/src/constants/billing.constants.ts`), so the
 *    `owner-basico` / `owner-pro` / `owner-premium` rows already exist at the
 *    NEW trial length before any test runs. Every test that wants to observe
 *    a 14→30 conversion must first drive `metadata.trialDays` (and, for
 *    carrier 2, the monthly `billing_prices.trialDays`) back down to 14
 *    itself.
 * 2. `globalSetup` seeds ONLY `billing_plans`, never `billing_prices` (see
 *    its own comment: "the tests never read billing_prices") — so this
 *    suite's price-row fixture helper must be prepared to INSERT a fresh
 *    row, not just UPDATE an existing one.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    and,
    billingPlans,
    billingPrices,
    type DrizzleClient,
    eq,
    getDb,
    initializeDb,
    resetDb
} from '@repo/db';
import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as ownerTrial30Days from '../../src/data-migrations/0055-owner-trial-30-days.js';
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
    id: 'actor-stub-owner-trial-30-days',
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

/** The pre-change trial length, in days, this migration replaces. */
const OLD_TRIAL_DAYS = 14;

/** The owner-confirmed owner-tier trial length, in days. */
const NEW_TRIAL_DAYS = 30;

/**
 * Builds a full `billing_plans.metadata` object matching the real shape
 * `billingPlans.seed.ts`'s `ensurePlan()` writes (`slug`, `displayName`,
 * `category`, `isDefault`, `sortOrder`, `trialDays`, `hasTrial`,
 * `monthlyPriceArs`, `annualPriceArs`, `monthlyPriceUsdRef`), so a test can
 * assert every unrelated sub-field survives the migration's `||` merge.
 */
function ownerMetadata(
    slug: string,
    displayName: string,
    trialDays: number
): Record<string, unknown> {
    return {
        slug,
        displayName,
        category: 'owner',
        isDefault: false,
        sortOrder: 1,
        trialDays,
        hasTrial: true,
        monthlyPriceArs: 500000,
        annualPriceArs: 5000000,
        monthlyPriceUsdRef: 5
    };
}

/**
 * Ensures a `billing_plans` row exists for `slug` with EXACTLY `metadata`
 * (a full replace, not a merge), updating it in place if the row already
 * exists (as it will for `owner-basico`/`owner-pro`/`owner-premium`/
 * `complex-*`, seeded by `globalSetup`) or inserting a minimal fixture row
 * otherwise. Returns the plan id.
 */
async function ensurePlanMetadataFixture(
    tx: DrizzleClient,
    slug: string,
    metadata: Record<string, unknown>
): Promise<string> {
    const existing = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const planRow = existing[0];
    if (planRow) {
        await tx.update(billingPlans).set({ metadata }).where(eq(billingPlans.id, planRow.id));
        return planRow.id;
    }

    const inserted = await tx
        .insert(billingPlans)
        .values({
            name: slug,
            description: `Test fixture plan for ${slug}`,
            active: true,
            entitlements: [],
            limits: {},
            livemode: true,
            displayName: (metadata.displayName as string | undefined) ?? slug,
            monthlyPriceArs: (metadata.monthlyPriceArs as number | undefined) ?? 500000,
            annualPriceArs: (metadata.annualPriceArs as number | undefined) ?? 5000000,
            metadata
        })
        .returning({ id: billingPlans.id });

    const insertedRow = inserted[0];
    if (!insertedRow) {
        throw new Error(`Insert of test-fixture plan "${slug}" returned no row`);
    }
    return insertedRow.id;
}

/**
 * Ensures the active ARS `billing_prices` row for `(planId, billingInterval)`
 * carries `trialDays`, updating it in place if present or inserting a fresh
 * row otherwise. `globalSetup` seeds only `billing_plans` (never
 * `billing_prices`), so the insert branch is the common case in this suite.
 */
async function ensurePlanPriceTrialDays(
    tx: DrizzleClient,
    planId: string,
    billingInterval: 'month' | 'year',
    trialDays: number
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
        await tx.update(billingPrices).set({ trialDays }).where(eq(billingPrices.id, priceRow.id));
        return;
    }

    await tx.insert(billingPrices).values({
        planId,
        currency: 'ARS',
        unitAmount: 500000,
        billingInterval,
        intervalCount: 1,
        active: true,
        livemode: true,
        trialDays
    });
}

/** Reads back a plan's `metadata` object. Returns `undefined` when the row does not exist. */
async function readPlanMetadata(
    tx: DrizzleClient,
    slug: string
): Promise<Record<string, unknown> | undefined> {
    const rows = await tx
        .select({ metadata: billingPlans.metadata })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const row = rows[0];
    return row ? ((row.metadata ?? {}) as Record<string, unknown>) : undefined;
}

/**
 * Reads back the active ARS `billing_prices.trialDays` for `(slug,
 * billingInterval)`. Returns `undefined` when either the plan or the price
 * row does not exist.
 */
async function readPlanPriceTrialDays(
    tx: DrizzleClient,
    slug: string,
    billingInterval: 'month' | 'year'
): Promise<number | undefined> {
    const planRows = await tx
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, slug))
        .limit(1);

    const planRow = planRows[0];
    if (!planRow) {
        return undefined;
    }

    const priceRows = await tx
        .select({ trialDays: billingPrices.trialDays })
        .from(billingPrices)
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, billingInterval),
                eq(billingPrices.intervalCount, 1)
            )
        )
        .limit(1);

    return priceRows[0]?.trialDays;
}

/**
 * Removes a plan's `billing_plans` row and its `billing_prices` rows (if
 * present), so a test can start from a known "plan does not exist" state.
 * Deletes prices first to satisfy the `billing_prices.plan_id` FK.
 */
async function removePlanFixture(tx: DrizzleClient, slug: string): Promise<void> {
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

describe('0055-owner-trial-30-days', () => {
    it('converges both carriers for owner-basico, owner-pro, and owner-premium from the old 14-day trial', async () => {
        await withRollback(async (tx) => {
            const basicoId = await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                ownerMetadata('owner-basico', 'Basico', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', OLD_TRIAL_DAYS);
            const proId = await ensurePlanMetadataFixture(
                tx,
                'owner-pro',
                ownerMetadata('owner-pro', 'Pro', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, proId, 'month', OLD_TRIAL_DAYS);
            const premiumId = await ensurePlanMetadataFixture(
                tx,
                'owner-premium',
                ownerMetadata('owner-premium', 'Premium', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, premiumId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await ownerTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(3);
            expect(result.counts?.priceRowsUpdated).toBe(3);

            const basicoMetadata = await readPlanMetadata(tx, 'owner-basico');
            expect(basicoMetadata?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-basico', 'month')).toBe(NEW_TRIAL_DAYS);

            const proMetadata = await readPlanMetadata(tx, 'owner-pro');
            expect(proMetadata?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-pro', 'month')).toBe(NEW_TRIAL_DAYS);

            const premiumMetadata = await readPlanMetadata(tx, 'owner-premium');
            expect(premiumMetadata?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-premium', 'month')).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('is idempotent: a second up() updates zero rows across both counters', async () => {
        await withRollback(async (tx) => {
            const basicoId = await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                ownerMetadata('owner-basico', 'Basico', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', OLD_TRIAL_DAYS);
            const proId = await ensurePlanMetadataFixture(
                tx,
                'owner-pro',
                ownerMetadata('owner-pro', 'Pro', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, proId, 'month', OLD_TRIAL_DAYS);
            const premiumId = await ensurePlanMetadataFixture(
                tx,
                'owner-premium',
                ownerMetadata('owner-premium', 'Premium', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, premiumId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await ownerTrial30Days.up(ctx);
            expect(first.counts?.planRowsUpdated).toBe(3);
            expect(first.counts?.priceRowsUpdated).toBe(3);

            const second = await ownerTrial30Days.up(ctx);
            expect(second.counts?.planRowsUpdated).toBe(0);
            expect(second.counts?.priceRowsUpdated).toBe(0);

            expect((await readPlanMetadata(tx, 'owner-basico'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'owner-pro'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'owner-premium'))?.trialDays).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('preserves an operator-overridden trial while the sibling plans still converge (per-row guard)', async () => {
        await withRollback(async (tx) => {
            // owner-basico: an operator already set a custom 21-day trial via
            // the admin plan editor, on BOTH carriers — neither equals the old
            // 14-day placeholder anymore, so the guard must leave both
            // untouched.
            const basicoId = await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                ownerMetadata('owner-basico', 'Basico', 21)
            );
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', 21);
            // owner-pro / owner-premium: still at the old baseline, so they
            // converge normally.
            const proId = await ensurePlanMetadataFixture(
                tx,
                'owner-pro',
                ownerMetadata('owner-pro', 'Pro', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, proId, 'month', OLD_TRIAL_DAYS);
            const premiumId = await ensurePlanMetadataFixture(
                tx,
                'owner-premium',
                ownerMetadata('owner-premium', 'Premium', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, premiumId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await ownerTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(2);
            expect(result.counts?.priceRowsUpdated).toBe(2);

            // Operator-overridden plan: untouched on both carriers.
            expect((await readPlanMetadata(tx, 'owner-basico'))?.trialDays).toBe(21);
            expect(await readPlanPriceTrialDays(tx, 'owner-basico', 'month')).toBe(21);

            // Still-old siblings: converged on both carriers.
            expect((await readPlanMetadata(tx, 'owner-pro'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-pro', 'month')).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'owner-premium'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-premium', 'month')).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('never touches complex-basico even when it is also at a 14-day trial (regression: complex plans must stay at 14)', async () => {
        await withRollback(async (tx) => {
            // The owner decision explicitly EXCLUDES complex-* plans from the
            // 14→30 raise — they stay at 14 (COMPLEX_TRIAL_DAYS, deliberately
            // decoupled from OWNER_TRIAL_DAYS since HOS-301 D1). This
            // migration's WHERE clause names only the three owner-* slugs — a
            // complex plan sitting at the SAME 14-day value must survive a
            // run completely unchanged.
            await ensurePlanMetadataFixture(
                tx,
                'complex-basico',
                ownerMetadata('complex-basico', 'Complex Basico', OLD_TRIAL_DAYS)
            );
            const basicoId = await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                ownerMetadata('owner-basico', 'Basico', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', OLD_TRIAL_DAYS);
            const proId = await ensurePlanMetadataFixture(
                tx,
                'owner-pro',
                ownerMetadata('owner-pro', 'Pro', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, proId, 'month', OLD_TRIAL_DAYS);
            const premiumId = await ensurePlanMetadataFixture(
                tx,
                'owner-premium',
                ownerMetadata('owner-premium', 'Premium', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, premiumId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await ownerTrial30Days.up(ctx);

            // Sanity: the owner plans DID converge (proves the guard isn't a
            // false negative that would make the complex-basico assertion
            // trivial).
            expect(result.counts?.planRowsUpdated).toBe(3);
            expect((await readPlanMetadata(tx, 'owner-basico'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'owner-pro'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'owner-premium'))?.trialDays).toBe(NEW_TRIAL_DAYS);

            // complex-basico is untouched — still 14, never 30.
            expect((await readPlanMetadata(tx, 'complex-basico'))?.trialDays).toBe(OLD_TRIAL_DAYS);
        });
    });

    it('merges the metadata update onto existing metadata, preserving every unrelated sub-field', async () => {
        await withRollback(async (tx) => {
            const before = ownerMetadata('owner-basico', 'Basico', OLD_TRIAL_DAYS);
            const basicoId = await ensurePlanMetadataFixture(tx, 'owner-basico', before);
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await ownerTrial30Days.up(ctx);

            const after = await readPlanMetadata(tx, 'owner-basico');
            // Every field except trialDays survives the `||` merge unchanged.
            expect(after).toEqual({ ...before, trialDays: NEW_TRIAL_DAYS });
            expect(after?.hasTrial).toBe(true);
            expect(after?.displayName).toBe('Basico');
            expect(after?.category).toBe('owner');
            expect(after?.monthlyPriceArs).toBe(500000);
        });
    });

    it('does not attach a trial to the annual price row — only the active monthly row is mirrored', async () => {
        await withRollback(async (tx) => {
            const basicoId = await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                ownerMetadata('owner-basico', 'Basico', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, basicoId, 'month', OLD_TRIAL_DAYS);
            // Deliberately edge-case: the annual row ALSO carries 14
            // (production rows normally never set a trial on the annual
            // interval — see billingPlans.seed.ts's ensurePrice — but the
            // migration's WHERE clause must exclude it by billingInterval,
            // not merely fail to match by accident).
            await ensurePlanPriceTrialDays(tx, basicoId, 'year', OLD_TRIAL_DAYS);

            const proId = await ensurePlanMetadataFixture(
                tx,
                'owner-pro',
                ownerMetadata('owner-pro', 'Pro', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, proId, 'month', OLD_TRIAL_DAYS);
            await ensurePlanPriceTrialDays(tx, proId, 'year', OLD_TRIAL_DAYS);

            const premiumId = await ensurePlanMetadataFixture(
                tx,
                'owner-premium',
                ownerMetadata('owner-premium', 'Premium', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, premiumId, 'month', OLD_TRIAL_DAYS);
            await ensurePlanPriceTrialDays(tx, premiumId, 'year', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await ownerTrial30Days.up(ctx);

            // Only the three monthly rows count toward priceRowsUpdated.
            expect(result.counts?.priceRowsUpdated).toBe(3);

            expect(await readPlanPriceTrialDays(tx, 'owner-basico', 'month')).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-basico', 'year')).toBe(OLD_TRIAL_DAYS);

            expect(await readPlanPriceTrialDays(tx, 'owner-pro', 'month')).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-pro', 'year')).toBe(OLD_TRIAL_DAYS);

            expect(await readPlanPriceTrialDays(tx, 'owner-premium', 'month')).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'owner-premium', 'year')).toBe(OLD_TRIAL_DAYS);
        });
    });

    it('is a no-op when none of the three owner plans exists on this environment', async () => {
        await withRollback(async (tx) => {
            await removePlanFixture(tx, 'owner-basico');
            await removePlanFixture(tx, 'owner-pro');
            await removePlanFixture(tx, 'owner-premium');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await ownerTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);
            expect(result.summary).toContain(`${OLD_TRIAL_DAYS}-day`);
        });
    });
});
