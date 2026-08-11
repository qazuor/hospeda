/**
 * @fileoverview
 * Data migration: 0051-hos-301-tourist-trial-30-days
 *
 * Raises the self-service tourist plans' trial from 14 to 30 days (HOS-301 D1,
 * owner-confirmed 2026-08-11). Owner and complex plans stay at 14.
 *
 * ## Why this migration exists (Model C)
 *
 * `trialDays` is a `'commercial'` field in
 * `packages/billing/src/config/model-c-field-split.ts` — the DB wins and the
 * seeder never overwrites it. Editing `TOURIST_TRIAL_DAYS` alone therefore only
 * changes a fresh `db:fresh`/`db:fresh-dev`. Direct precedent:
 * `0017-hos-210-tourist-plan-trial.ts`, which set these same two plans to 14
 * the same way.
 *
 * ## The constant that had to be decoupled first
 *
 * `TOURIST_TRIAL_DAYS` was defined as `= OWNER_TRIAL_DAYS` (HOS-210), precisely
 * so the tiers could not drift. Raising it through that alias would have
 * silently taken owner and complex trials from 14 to 30 as well. The baseline
 * half of this change turns it back into a literal — see
 * `packages/billing/src/constants/billing.constants.ts`.
 *
 * ## What it updates
 *
 * Both carriers the seed writes for a trial:
 *
 * 1. `billing_plans.metadata.trialDays` — the load-bearing one.
 *    `readPlanTrialConfig()` (`trial.types.ts:340-341`) reads `hasTrial` /
 *    `trialDays` off the plan's metadata, and that value feeds
 *    `resolveCheckoutFreeTrialDays()`, which decides the `free_trial` sent to
 *    MercadoPago at checkout.
 * 2. `billing_prices.trialDays` on the active monthly row — the mirror
 *    `ensurePrice()` writes and `plan.crud.ts:485` reproduces on create.
 *    Nothing currently reads it, but leaving it at 14 would make the two rows
 *    disagree about the same plan.
 *
 * `hasTrial` is untouched: 0017 already set it to `true` on both plans, and D1
 * changes only the length.
 *
 * ## MercadoPago
 *
 * No manual action required. `billing_mp_plans` is keyed on
 * `(commercialPlanId, billingInterval, trialDays, discountCycle1AmountCentavos)`
 * and provisioned lazily, so the first checkout after this migration creates a
 * new `preapproval_plan` for the 30-day combination on its own. Existing
 * subscriptions keep the trial they were sold.
 *
 * ## Idempotency
 *
 * Both UPDATEs are guarded on the old value (14), so a second run affects zero
 * rows and a length an operator already changed through the admin plan editor
 * is left alone. Absent plan rows are a documented no-op.
 *
 * ## `destructive` flag decision
 *
 * `false`. Guarded UPDATEs on a commercial field. No deletes.
 */
import { and, billingPlans, billingPrices, eq, inArray, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0051-hos-301-tourist-trial-30-days',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The plan rows this migration targets (`billing_plans.name` = the slug). */
const TOURIST_PLAN_SLUGS = ['tourist-plus', 'tourist-vip'] as const;

/** The pre-D1 trial length, in days, this migration replaces. */
const OLD_TRIAL_DAYS = 14;

/** The D1-confirmed tourist trial length, in days. */
const NEW_TRIAL_DAYS = 30;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── Carrier 1: the metadata the checkout actually reads ──────────────
    const updatedPlans = await ctx.db
        .update(billingPlans)
        .set({
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('trialDays', ${NEW_TRIAL_DAYS}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...TOURIST_PLAN_SLUGS]),
                // Only move a plan still at the old length — an operator-set
                // value (or an already-converged one) no longer matches.
                sql`(${billingPlans.metadata}->>'trialDays')::int = ${OLD_TRIAL_DAYS}`
            )
        )
        .returning({ id: billingPlans.id, name: billingPlans.name });

    // ── Carrier 2: the mirror on the active monthly price row ────────────
    let priceRowsUpdated = 0;

    if (updatedPlans.length > 0) {
        const updatedPrices = await ctx.db
            .update(billingPrices)
            .set({ trialDays: NEW_TRIAL_DAYS })
            .where(
                and(
                    inArray(
                        billingPrices.planId,
                        updatedPlans.map((row) => row.id)
                    ),
                    eq(billingPrices.billingInterval, 'month'),
                    eq(billingPrices.intervalCount, 1),
                    eq(billingPrices.active, true),
                    eq(billingPrices.trialDays, OLD_TRIAL_DAYS)
                )
            )
            .returning({ id: billingPrices.id });

        priceRowsUpdated = updatedPrices.length;
    }

    const updatedNames = updatedPlans.map((row) => row.name).join(', ');

    return {
        summary:
            updatedPlans.length === 0
                ? `No tourist plan was still at a ${OLD_TRIAL_DAYS}-day trial — nothing to update.`
                : `Raised the tourist trial to ${NEW_TRIAL_DAYS} days on ${updatedPlans.length} plan(s) (${updatedNames}) and ${priceRowsUpdated} price row mirror(s).`,
        counts: { planRowsUpdated: updatedPlans.length, priceRowsUpdated }
    };
}
