/**
 * @fileoverview
 * Data migration: 0004-test-daily-plan
 *
 * Dual-write counterpart (HOS-25) for the baseline seed
 * `packages/seed/src/required/testDailyPlan.seed.ts` (`seedTestDailyPlan`),
 * itself driven by `TEST_DAILY_PLAN` in
 * `packages/billing/src/config/plans.config.ts` — the billing-interval-override
 * testing tooling's hidden daily test plan.
 *
 * Introduces the `owner-test-daily` plan (bills every 1 day instead of
 * monthly, so an operator can exercise the full MercadoPago recurring-charge
 * lifecycle on a fast cadence, gated behind `HOSPEDA_SHOW_TEST_BILLING_PLAN`
 * — see `resolvePlanBySlug` in
 * `apps/api/src/services/subscription-checkout.service.ts`) plus its single
 * daily `billing_prices` row.
 *
 * Why this migration exists (not just the baseline seed): `seedTestDailyPlan`
 * only builds this row correctly on a FRESH database via `pnpm db:seed
 * --required`. A non-`--reset` `--required` run against an ALREADY-SEEDED
 * staging/prod database currently aborts earlier, at the users factory
 * seeder (no unique-constraint guard there) — see
 * `.specs/HOS-25-versioned-seed-data-migrations/spec.md` §2 ("The structural
 * failure"). This versioned migration is the reliable, repeatable way to get
 * the same row onto an already-seeded live environment.
 *
 * Not reusing `seedTestDailyPlan` directly: it calls `getDb()` internally
 * (the ambient pool connection) rather than accepting an injected client, so
 * calling it here would write OUTSIDE this migration's own runner-managed
 * transaction — breaking the "throw -> rollback -> no ledger entry"
 * guarantee every other data-migration relies on. The upsert logic below is
 * a direct, `ctx.db`-scoped port of the same steps `seedTestDailyPlan`
 * performs (matched field-for-field), not a reimplementation of new
 * behavior.
 *
 * Idempotent (safe to re-run, though the runner only ever runs an applied
 * migration once per environment — see `runner.ts`'s ledger check):
 *   - Plan row: inserted only if no row exists with `name = 'owner-test-daily'`.
 *   - `product_domain` + `metadata` are re-stamped unconditionally on every
 *     `up()` call (matches `seedTestDailyPlan`'s own re-stamp-on-every-run
 *     behavior), self-healing those two fields regardless of how the
 *     existing row got there.
 *   - Price row: inserted only if no row exists for
 *     `(plan_id, currency='ARS', billing_interval='day', interval_count=1)`.
 *
 * `active = false` on the plan row is intentional (NOT a bug to "fix" in a
 * follow-up): it is what keeps `owner-test-daily` off the PUBLIC plans list
 * (`GET /api/v1/public/plans` filters `active = true`). The daily price row
 * stays `active = true` — MercadoPago only reads the price's own active
 * flag when creating the recurring preapproval.
 *
 * `livemode = true` on both rows: `NODE_ENV` is `'production'` on BOTH the
 * prod and staging deployments (repo-wide convention — see root CLAUDE.md),
 * matching what `seedTestDailyPlan` would compute
 * (`isProduction = NODE_ENV === 'production'`) if it ran directly against
 * either environment.
 *
 * Dual-write: the baseline fixture (`TEST_DAILY_PLAN` /
 * `seedTestDailyPlan.ts`) and this migration were authored in the SAME PR
 * and already produce byte-identical end state — no further baseline update
 * needed (unlike a migration that backfills a change the baseline already
 * had for OTHER reasons, this migration and its baseline are twins by
 * construction).
 *
 * ## `destructive` flag decision
 *
 * Set to `false`. This migration only INSERTs (when missing) and does one
 * unconditional but harmless re-stamp UPDATE (`product_domain` + `metadata`,
 * never `active` or any commercial field) — it never deletes or destructively
 * mutates existing data, and re-running it against an already-migrated
 * database converges to the identical end state.
 */
import { TEST_DAILY_PLAN, TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS } from '@repo/billing';
import { and, billingPlans, billingPrices, eq } from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0004-test-daily-plan',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * Builds the `metadata` jsonb payload for the `owner-test-daily` plan row.
 * Extracted so both the INSERT and the re-stamp UPDATE below use the exact
 * same shape — mirrors `seedTestDailyPlan.ts`'s duplicated-inline pattern,
 * but as a single function here since a migration has no equivalent
 * "created vs skipped" branch needing two separate literal blocks.
 */
function buildTestDailyPlanMetadata(): Record<string, unknown> {
    return {
        slug: TEST_DAILY_PLAN.slug,
        displayName: TEST_DAILY_PLAN.name,
        category: TEST_DAILY_PLAN.category,
        isDefault: TEST_DAILY_PLAN.isDefault,
        sortOrder: TEST_DAILY_PLAN.sortOrder,
        trialDays: TEST_DAILY_PLAN.trialDays,
        hasTrial: TEST_DAILY_PLAN.hasTrial,
        // Identifiability beyond the slug (per the billing-interval-override spec).
        testPlan: true
    };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const plan = TEST_DAILY_PLAN;

    // ── Ensure the plan row (idempotent by slug) ─────────────────────────
    const existingPlan = await ctx.db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, plan.slug))
        .limit(1);

    let planId: string;
    let planCreated = false;

    const existingPlanRow = existingPlan[0];
    if (existingPlanRow) {
        planId = existingPlanRow.id;
    } else {
        const limitsObj: Record<string, number> = {};
        for (const l of plan.limits) {
            limitsObj[l.key] = l.value;
        }

        const inserted = await ctx.db
            .insert(billingPlans)
            .values({
                name: plan.slug,
                description: plan.description,
                active: plan.isActive,
                entitlements: plan.entitlements as string[],
                limits: limitsObj,
                livemode: true,
                displayName: plan.name,
                // No monthly/annual price ROW is ever created for this plan —
                // `plan.monthlyPriceArs` here only fills the typed display
                // column, mirroring the commerce/partner seed pattern.
                monthlyPriceArs: plan.monthlyPriceArs,
                annualPriceArs: plan.annualPriceArs,
                productDomain: ProductDomainEnum.ACCOMMODATION,
                metadata: buildTestDailyPlanMetadata()
            })
            .returning({ id: billingPlans.id });

        const insertedRow = inserted[0];
        if (!insertedRow) {
            throw new Error(`Insert of test daily plan "${plan.slug}" returned no row`);
        }
        planId = insertedRow.id;
        planCreated = true;
    }

    // ── Re-stamp product_domain + metadata.testPlan (idempotent no-op) ───
    await ctx.db
        .update(billingPlans)
        .set({
            productDomain: ProductDomainEnum.ACCOMMODATION,
            metadata: buildTestDailyPlanMetadata()
        })
        .where(eq(billingPlans.id, planId));

    // ── Ensure the daily price row (idempotent) ───────────────────────────
    const existingPrice = await ctx.db
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

    let priceCreated = false;
    if (existingPrice.length === 0) {
        await ctx.db.insert(billingPrices).values({
            planId,
            currency: 'ARS',
            unitAmount: TEST_DAILY_PLAN_UNIT_AMOUNT_CENTAVOS,
            billingInterval: 'day',
            intervalCount: 1,
            active: true,
            livemode: true
        });
        priceCreated = true;
    }

    return {
        summary: `Test daily plan ${planCreated ? 'created' : 'already existed (re-stamped)'}; daily price ${priceCreated ? 'created' : 'already existed'}.`,
        counts: {
            planCreated: planCreated ? 1 : 0,
            priceCreated: priceCreated ? 1 : 0
        }
    };
}
