/**
 * @fileoverview
 * Integration tests for `0051-hos-301-tourist-trial-30-days.ts` (HOS-301 D1).
 *
 * Modeled on `hos-301-reprice-owner-plans.integration.test.ts` and
 * `hos-210-tourist-plan-trial.integration.test.ts`: runs against the REAL
 * PostgreSQL database the `packages/seed` integration `globalSetup` provisions
 * (`hospeda_seed_integration_test`), using the same rollback-isolation idiom
 * established by `test-daily-plan-min-amount.integration.test.ts`. Every test
 * opens a `db.transaction()`, drives the `billing_plans` / `billing_prices`
 * rows to a known starting state, runs `up()`, asserts, then unconditionally
 * throws a sentinel `RollbackSignal` so nothing this suite writes survives
 * past the test that wrote it.
 *
 * Two things make explicit state-seeding mandatory here rather than optional:
 *
 * 1. `globalSetup` seeds `billing_plans` from `ALL_PLANS` (current branch
 *    state: `TOURIST_TRIAL_DAYS = 30` already, per
 *    `packages/billing/src/constants/billing.constants.ts`), so the
 *    `tourist-plus` / `tourist-vip` rows already exist at the NEW trial
 *    length before any test runs. Every test that wants to observe a 14→30
 *    conversion must first drive `metadata.trialDays` (and, for carrier 2,
 *    the monthly `billing_prices.trialDays`) back down to 14 itself.
 * 2. `globalSetup` seeds ONLY `billing_plans`, never `billing_prices` (see its
 *    own comment: "the tests never read billing_prices") — so this suite's
 *    price-row fixture helper must be prepared to INSERT a fresh row, not
 *    just UPDATE an existing one.
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
import * as touristTrial30Days from '../../src/data-migrations/0051-hos-301-tourist-trial-30-days.js';
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
    id: 'actor-stub-hos301-tourist-trial-30-days',
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

/** The pre-D1 trial length, in days, this migration replaces. */
const OLD_TRIAL_DAYS = 14;

/** The D1-confirmed tourist trial length, in days. */
const NEW_TRIAL_DAYS = 30;

/**
 * Builds a full `billing_plans.metadata` object matching the real shape
 * `billingPlans.seed.ts`'s `ensurePlan()` writes (`slug`, `displayName`,
 * `category`, `isDefault`, `sortOrder`, `trialDays`, `hasTrial`,
 * `monthlyPriceArs`, `annualPriceArs`, `monthlyPriceUsdRef`), so a test can
 * assert every unrelated sub-field survives the migration's `||` merge.
 */
function touristMetadata(
    slug: string,
    displayName: string,
    trialDays: number
): Record<string, unknown> {
    return {
        slug,
        displayName,
        category: 'tourist',
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
 * exists (as it will for `tourist-plus`/`tourist-vip`/`owner-basico`, seeded
 * by `globalSetup`) or inserting a minimal fixture row otherwise. Returns the
 * plan id.
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

describe('0051-hos-301-tourist-trial-30-days', () => {
    it('converges both carriers for tourist-plus and tourist-vip from the old 14-day trial', async () => {
        await withRollback(async (tx) => {
            const plusId = await ensurePlanMetadataFixture(
                tx,
                'tourist-plus',
                touristMetadata('tourist-plus', 'Plus', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, plusId, 'month', OLD_TRIAL_DAYS);
            const vipId = await ensurePlanMetadataFixture(
                tx,
                'tourist-vip',
                touristMetadata('tourist-vip', 'VIP', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, vipId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(2);
            expect(result.counts?.priceRowsUpdated).toBe(2);

            const plusMetadata = await readPlanMetadata(tx, 'tourist-plus');
            expect(plusMetadata?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'tourist-plus', 'month')).toBe(NEW_TRIAL_DAYS);

            const vipMetadata = await readPlanMetadata(tx, 'tourist-vip');
            expect(vipMetadata?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'tourist-vip', 'month')).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('is idempotent: a second up() updates zero rows across both counters', async () => {
        await withRollback(async (tx) => {
            const plusId = await ensurePlanMetadataFixture(
                tx,
                'tourist-plus',
                touristMetadata('tourist-plus', 'Plus', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, plusId, 'month', OLD_TRIAL_DAYS);
            const vipId = await ensurePlanMetadataFixture(
                tx,
                'tourist-vip',
                touristMetadata('tourist-vip', 'VIP', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, vipId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });

            const first = await touristTrial30Days.up(ctx);
            expect(first.counts?.planRowsUpdated).toBe(2);
            expect(first.counts?.priceRowsUpdated).toBe(2);

            const second = await touristTrial30Days.up(ctx);
            expect(second.counts?.planRowsUpdated).toBe(0);
            expect(second.counts?.priceRowsUpdated).toBe(0);

            expect((await readPlanMetadata(tx, 'tourist-plus'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'tourist-vip'))?.trialDays).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('preserves an operator-overridden trial while the sibling plan still converges (per-row guard)', async () => {
        await withRollback(async (tx) => {
            // tourist-plus: an operator already set a custom 21-day trial via the
            // admin plan editor, on BOTH carriers — neither equals the old 14-day
            // placeholder anymore, so the guard must leave both untouched.
            const plusId = await ensurePlanMetadataFixture(
                tx,
                'tourist-plus',
                touristMetadata('tourist-plus', 'Plus', 21)
            );
            await ensurePlanPriceTrialDays(tx, plusId, 'month', 21);
            // tourist-vip: still at the old baseline, so it converges normally.
            const vipId = await ensurePlanMetadataFixture(
                tx,
                'tourist-vip',
                touristMetadata('tourist-vip', 'VIP', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, vipId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(1);
            expect(result.counts?.priceRowsUpdated).toBe(1);

            // Operator-overridden plan: untouched on both carriers.
            expect((await readPlanMetadata(tx, 'tourist-plus'))?.trialDays).toBe(21);
            expect(await readPlanPriceTrialDays(tx, 'tourist-plus', 'month')).toBe(21);

            // Still-old sibling: converged on both carriers.
            expect((await readPlanMetadata(tx, 'tourist-vip'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'tourist-vip', 'month')).toBe(NEW_TRIAL_DAYS);
        });
    });

    it('never touches owner-basico even when it is also at a 14-day trial (regression: TOURIST_TRIAL_DAYS must not alias OWNER_TRIAL_DAYS)', async () => {
        await withRollback(async (tx) => {
            // TOURIST_TRIAL_DAYS used to be a literal alias of OWNER_TRIAL_DAYS
            // (HOS-210). This migration's WHERE clause names only
            // 'tourist-plus'/'tourist-vip' — an owner plan sitting at the SAME
            // 14-day value must survive a run completely unchanged.
            await ensurePlanMetadataFixture(
                tx,
                'owner-basico',
                touristMetadata('owner-basico', 'Basic', OLD_TRIAL_DAYS)
            );
            const plusId = await ensurePlanMetadataFixture(
                tx,
                'tourist-plus',
                touristMetadata('tourist-plus', 'Plus', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, plusId, 'month', OLD_TRIAL_DAYS);
            const vipId = await ensurePlanMetadataFixture(
                tx,
                'tourist-vip',
                touristMetadata('tourist-vip', 'VIP', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, vipId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristTrial30Days.up(ctx);

            // Sanity: the tourist plans DID converge (proves the guard isn't a
            // false negative that would make the owner-basico assertion trivial).
            expect(result.counts?.planRowsUpdated).toBe(2);
            expect((await readPlanMetadata(tx, 'tourist-plus'))?.trialDays).toBe(NEW_TRIAL_DAYS);
            expect((await readPlanMetadata(tx, 'tourist-vip'))?.trialDays).toBe(NEW_TRIAL_DAYS);

            // owner-basico is untouched — still 14, never 30.
            expect((await readPlanMetadata(tx, 'owner-basico'))?.trialDays).toBe(OLD_TRIAL_DAYS);
        });
    });

    it('merges the metadata update onto existing metadata, preserving every unrelated sub-field', async () => {
        await withRollback(async (tx) => {
            const before = touristMetadata('tourist-plus', 'Plus', OLD_TRIAL_DAYS);
            const plusId = await ensurePlanMetadataFixture(tx, 'tourist-plus', before);
            await ensurePlanPriceTrialDays(tx, plusId, 'month', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            await touristTrial30Days.up(ctx);

            const after = await readPlanMetadata(tx, 'tourist-plus');
            // Every field except trialDays survives the `||` merge unchanged.
            expect(after).toEqual({ ...before, trialDays: NEW_TRIAL_DAYS });
            expect(after?.hasTrial).toBe(true);
            expect(after?.displayName).toBe('Plus');
            expect(after?.category).toBe('tourist');
            expect(after?.monthlyPriceArs).toBe(500000);
        });
    });

    it('does not attach a trial to the annual price row — only the active monthly row is mirrored', async () => {
        await withRollback(async (tx) => {
            const plusId = await ensurePlanMetadataFixture(
                tx,
                'tourist-plus',
                touristMetadata('tourist-plus', 'Plus', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, plusId, 'month', OLD_TRIAL_DAYS);
            // Deliberately edge-case: the annual row ALSO carries 14 (production
            // rows normally never set a trial on the annual interval — see
            // billingPlans.seed.ts's ensurePrice — but the migration's WHERE
            // clause must exclude it by billingInterval, not merely fail to
            // match by accident).
            await ensurePlanPriceTrialDays(tx, plusId, 'year', OLD_TRIAL_DAYS);

            const vipId = await ensurePlanMetadataFixture(
                tx,
                'tourist-vip',
                touristMetadata('tourist-vip', 'VIP', OLD_TRIAL_DAYS)
            );
            await ensurePlanPriceTrialDays(tx, vipId, 'month', OLD_TRIAL_DAYS);
            await ensurePlanPriceTrialDays(tx, vipId, 'year', OLD_TRIAL_DAYS);

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristTrial30Days.up(ctx);

            // Only the two monthly rows count toward priceRowsUpdated.
            expect(result.counts?.priceRowsUpdated).toBe(2);

            expect(await readPlanPriceTrialDays(tx, 'tourist-plus', 'month')).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'tourist-plus', 'year')).toBe(OLD_TRIAL_DAYS);

            expect(await readPlanPriceTrialDays(tx, 'tourist-vip', 'month')).toBe(NEW_TRIAL_DAYS);
            expect(await readPlanPriceTrialDays(tx, 'tourist-vip', 'year')).toBe(OLD_TRIAL_DAYS);
        });
    });

    it('is a no-op when neither tourist-plus nor tourist-vip exists on this environment', async () => {
        await withRollback(async (tx) => {
            await removePlanFixture(tx, 'tourist-plus');
            await removePlanFixture(tx, 'tourist-vip');

            const ctx = await buildMigrationContext({ db: tx, actor: STUB_ACTOR });
            const result = await touristTrial30Days.up(ctx);

            expect(result.counts?.planRowsUpdated).toBe(0);
            expect(result.counts?.priceRowsUpdated).toBe(0);
            expect(result.summary).toContain(`${OLD_TRIAL_DAYS}-day`);
        });
    });
});
