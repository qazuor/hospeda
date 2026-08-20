/**
 * @fileoverview
 * Data migration: 0064-hos-590-commerce-vertical-trial-30-days
 *
 * Dual-write counterpart (HOS-25) for the HOS-590 baseline change: the two
 * sellable per-vertical commerce plans, `gastronomy-premium` and
 * `experience-premium` (HOS-688), now get the same 30-day card-first trial as
 * every accommodation-side plan (`hasTrial: true`, `trialDays: 30`) instead of
 * no trial at all (`hasTrial: false`, `trialDays: 0`).
 *
 * ## Why this migration exists
 *
 * `metadata.hasTrial` / `metadata.trialDays` are both classified `'commercial'`
 * in Model C (`packages/billing/src/config/model-c-field-split.ts`) — the DB
 * wins once a row exists, so editing the baseline alone
 * (`GASTRONOMY_PREMIUM_PLAN` / `EXPERIENCE_PREMIUM_PLAN` in
 * `packages/billing/src/config/plans.config.ts`) only reaches a FRESH
 * `db:fresh`/`db:fresh-dev`; an already-seeded staging/prod row never receives
 * the change on its own. Direct precedent: `0017-hos-210-tourist-plan-trial.ts`,
 * which did the exact same `false`/`0` -> `true`/`N` two-key flip for
 * `tourist-plus`/`tourist-vip`.
 *
 * ## What it updates
 *
 * Only `billing_plans.metadata` — the carrier the checkout actually reads.
 * `resolvePlanTrialConfig()` (`trial.types.ts`) reads `hasTrial` / `trialDays`
 * off the plan's metadata, and that feeds `resolveCheckoutFreeTrialDays()`,
 * which `initiateCommerceMonthlySubscription` (`subscription-checkout.service.ts`)
 * now calls instead of hardcoding `trialDays: 0` — the same canonical resolver
 * the accommodation checkout paths use.
 *
 * `billing_prices.trialDays` is deliberately NOT touched here, unlike
 * `0051-hos-301-tourist-trial-30-days.ts`. That migration updated the price
 * mirror because the accommodation seed's `ensurePrice()` already WRITES
 * `trialDays` onto the price row whenever `hasTrial` is true. The commerce seed
 * (`ensureCommercePlan` in `packages/seed/src/required/commercePlan.seed.ts`)
 * never did that for either plan (it inserted the monthly `billing_prices` row
 * with no `trialDays` at all, regardless of `hasTrial`), so there is no
 * existing mirror value to reconcile — same shape as `0017`, whose targets
 * were also flipping `hasTrial` `false` -> `true` for the first time and
 * likewise left `billing_prices` alone.
 *
 * ## MercadoPago
 *
 * No manual action required. `billing_mp_plans` is keyed on
 * `(commercialPlanId, billingInterval, trialDays, discountCycle1AmountCentavos)`
 * and provisioned lazily, so the first checkout after this migration creates a
 * NEW `preapproval_plan` for the 30-day combination on its own. Production has
 * zero live commerce subscriptions today (HOS-688), so there is nothing
 * existing to reconcile.
 *
 * ## OR-PRESERVE semantics
 *
 * The UPDATE only fires for a row whose `metadata.hasTrial` / `metadata.trialDays`
 * are STILL the exact old baseline default (`false` / `0`, including a legacy
 * row that predates either key entirely, via `COALESCE`) — mirroring `0017`'s
 * guard. An operator who already changed either field through the admin plan
 * editor is left alone.
 *
 * Re-running `up()` against an already-migrated database is always a no-op
 * (zero affected rows) once both keys read `true` / `30`, or once an operator
 * has moved either key off the old default.
 *
 * ## `destructive` flag decision
 *
 * `false`. Guarded UPDATE on two well-identified plan rows' JSONB metadata,
 * flipping from a known old default to a known new default. No deletes, and
 * trivially reversible via a one-line manual
 * `UPDATE billing_plans SET metadata = metadata || '{"hasTrial":false,"trialDays":0}'::jsonb
 * WHERE name IN ('gastronomy-premium','experience-premium')`.
 */
import { and, billingPlans, inArray, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0064-hos-590-commerce-vertical-trial-30-days',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The plan rows this migration targets (`billing_plans.name` = the slug). */
const PLAN_NAMES = ['gastronomy-premium', 'experience-premium'] as const;

/** New trial config (matches `GASTRONOMY_PREMIUM_PLAN` / `EXPERIENCE_PREMIUM_PLAN` post-HOS-590). */
const NEW_HAS_TRIAL = true;
const NEW_TRIAL_DAYS = 30;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const updated = await ctx.db
        .update(billingPlans)
        .set({
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('hasTrial', ${NEW_HAS_TRIAL}::boolean, 'trialDays', ${NEW_TRIAL_DAYS}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...PLAN_NAMES]),
                // OR-PRESERVE: only touch a row still at the old baseline default
                // (COALESCE covers a legacy row missing either key entirely).
                sql`COALESCE((${billingPlans.metadata}->>'hasTrial')::boolean, false) = false`,
                sql`COALESCE((${billingPlans.metadata}->>'trialDays')::int, 0) = 0`
            )
        )
        .returning({ name: billingPlans.name });

    const rowsUpdated = updated.length;
    const updatedNames = updated.map((row) => row.name).join(', ');

    return {
        summary:
            rowsUpdated === 0
                ? 'gastronomy-premium/experience-premium trial already set or operator-edited — no change.'
                : `Set metadata.hasTrial=true, metadata.trialDays=30 on ${rowsUpdated} commerce plan row(s): ${updatedNames}.`,
        counts: { rowsUpdated }
    };
}
