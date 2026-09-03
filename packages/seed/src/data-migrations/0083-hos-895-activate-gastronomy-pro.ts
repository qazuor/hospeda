/**
 * @fileoverview
 * Data migration: 0083-hos-895-activate-gastronomy-pro
 *
 * Dual-write counterpart (HOS-25) for the HOS-895 PR2 baseline change:
 * `gastronomy-pro` moves from disabled/unpriced to sellable at ARS
 * $45.000/mo with a 30-day trial.
 *
 * ## Why
 *
 * Owner decision (2026-09-03): activate the professional gastronomy tier —
 * the one that grants `manage_gastronomy_menu` (the structured carta, HOS-895)
 * — so it is finally a plan a real customer can be quoted, not just a row that
 * exists in the catalogue for its entitlements to be defined against. Until
 * this, `gastronomy-basico` was the ONLY active gastronomy plan and it does
 * NOT grant `manage_gastronomy_menu` — nobody could buy the carta feature PR1
 * shipped, regardless of what the frontend showed. See HOS-895 PR2's own PR
 * description for that finding.
 *
 * ## Why the baseline edit alone is not enough
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * matches by `name` and INSERTS ONLY — an existing row is skipped wholesale,
 * and `active` / `monthlyPriceArs` / `metadata` are `'commercial'` fields in
 * Model C, so the database wins. Editing `GASTRONOMY_PRO_PLAN` in
 * `packages/billing/src/config/plans.config.ts` therefore only reaches a
 * FRESH `db:fresh` / `db:fresh-dev`; the already-seeded staging and
 * production row (`gastronomy-pro`: inactive, priced 0, no trial, seeded
 * since HOS-688 purely so the plan existed for its entitlements to be typed
 * against) would never receive it.
 *
 * ## What it does
 *
 * 1. **Promotes the `gastronomy-pro` row**: `active = true`, `monthly_price_ars`
 *    to the new price, and `metadata.hasTrial` / `metadata.trialDays` to the
 *    same 30-day trial every other sellable commerce tier carries — without
 *    which activation would silently sell a plan with no trial while its
 *    `-basico` sibling still gets one, an asymmetry nobody decided.
 * 2. **Creates the missing monthly `billing_prices` row**. The original seed
 *    skipped it (`monthlyPriceArs <= 0` → "unpriced tier"), and checkout
 *    resolves the PRICE row, not the plan column: `NO_MONTHLY_PRICE` is a hard
 *    throw in the commerce checkout path. Without this step, activation alone
 *    would still fail the first real purchase attempt.
 *
 * Unlike HOS-818's `0071` migration (`*-premium` → `*-basico` sellable-tier
 * swap), this migration retires NOTHING and repoints NO subscriptions:
 * `gastronomy-pro` has never been reachable by any checkout (see the manual
 * step below), so it structurally cannot have any live subscription to move.
 *
 * ## MercadoPago
 *
 * Nothing to provision manually. `billing_mp_plans` is keyed on
 * `(commercialPlanId, billingInterval, trialDays, discountCycle1AmountCentavos)`
 * and provisioning is LAZY (`resolveOrProvisionMpPlan`,
 * `apps/api/src/services/billing/mp-plan-provisioning.service.ts`): the first
 * real checkout that resolves to this commercial plan id calls
 * `POST /preapproval_plan` itself and records the mapping. There is no
 * pre-existing preapproval to preserve here — this is NOT the HOS-818 case,
 * where the premium row already had live subscriptions and a live
 * `preapproval_plan` behind it. `gastronomy-pro` has neither.
 *
 * ## Manual step this migration cannot perform
 *
 * Promoting this row does NOT make it reachable. `resolveCommercePlanSlug`
 * (`apps/api/src/services/commerce-plan-resolver.ts`) is the ONE place a
 * commerce checkout turns a vertical into a plan slug, and it always resolves
 * to exactly ONE slug per vertical: `DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL.gastronomy`
 * (still `gastronomy-basico`, unchanged by this migration or by HOS-895 PR2)
 * unless `HOSPEDA_COMMERCE_PLAN_SLUGS` is set — which it is, explicitly, on
 * staging and production, and an explicit env value wins over the code
 * default. Commerce has no plan-picker and no plan-change/upgrade route
 * (unlike accommodation), so until an operator decides to repoint that
 * variable (in Coolify) at `gastronomy-pro`, or ships a way for an owner to
 * choose/upgrade tiers, no real checkout will ever resolve to this plan and
 * the lazy MercadoPago provisioning above will never fire. That decision is
 * explicitly OUT OF SCOPE here — this migration only makes the row a valid
 * subscription target, the same distinction `GASTRONOMY_PRO_PLAN`'s own doc
 * in `plans.config.ts` draws.
 *
 * ## OR-PRESERVE semantics
 *
 * The UPDATE is guarded on the row still holding the exact OLD baseline value
 * (inactive AND unpriced), so an operator who already edited this plan
 * through the admin editor is left alone, and a re-run against an
 * already-migrated database is a no-op (zero affected rows). The price
 * insert is guarded on absence and resolved from a fresh read rather than
 * from step 1's result, so a re-run also repairs a half-applied state where
 * the plan was promoted but the insert did not land.
 *
 * ## `destructive` flag decision
 *
 * `false`. No deletes, no repointing. One guarded UPDATE on one well-identified
 * plan row plus one additive price row. Reversible by flipping `active` back
 * and deleting the price row — no subscription ever depends on either.
 */
import { and, billingPlans, billingPrices, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0083-hos-895-activate-gastronomy-pro',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** `billing_plans.name` (the slug) of the tier this migration promotes. */
const PLAN_SLUG = 'gastronomy-pro';

/** Post-activation values (mirrors `GASTRONOMY_PRO_PLAN` in `plans.config.ts`). */
const NEW_MONTHLY_PRICE_ARS = 4_500_000;
const NEW_HAS_TRIAL = true;
const NEW_TRIAL_DAYS = 30;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── 1. Promote the row to the sellable configuration ─────────────────────
    const promoted = await ctx.db
        .update(billingPlans)
        .set({
            active: true,
            monthlyPriceArs: NEW_MONTHLY_PRICE_ARS,
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('hasTrial', ${NEW_HAS_TRIAL}::boolean, 'trialDays', ${NEW_TRIAL_DAYS}::int, 'monthlyPriceArs', ${NEW_MONTHLY_PRICE_ARS}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingPlans.name, PLAN_SLUG),
                // OR-PRESERVE: only a row still at the pre-activation baseline
                // (inactive AND unpriced). An operator who already priced or
                // enabled it made a decision this migration must not overwrite.
                eq(billingPlans.active, false),
                sql`COALESCE(${billingPlans.monthlyPriceArs}, 0) = 0`
            )
        )
        .returning({ name: billingPlans.name });

    // Re-read rather than trusting step 1's result: the row may have been
    // promoted just now, promoted by an earlier run, already active from an
    // operator edit, or absent entirely in this environment.
    const planRows = await ctx.db
        .select({
            id: billingPlans.id,
            active: billingPlans.active,
            livemode: billingPlans.livemode
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, PLAN_SLUG))
        .limit(1);

    const plan = planRows[0];
    if (!plan) {
        return {
            summary: `HOS-895 PR2: no "${PLAN_SLUG}" row in this environment — nothing to promote (the required seed will create it correctly-priced on its next run).`,
            counts: { plansPromoted: promoted.length, pricesCreated: 0 }
        };
    }

    // ── 2. Give the now-sellable plan its monthly ARS price row ──────────────
    let pricesCreated = 0;
    if (plan.active) {
        const existingPrices = await ctx.db
            .select({ id: billingPrices.id })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, plan.id),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'month'),
                    eq(billingPrices.intervalCount, 1)
                )
            )
            .limit(1);

        if (!existingPrices[0]) {
            await ctx.db.insert(billingPrices).values({
                planId: plan.id,
                currency: 'ARS',
                unitAmount: NEW_MONTHLY_PRICE_ARS,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                // Mirrors the plan row's own livemode, exactly as
                // `ensureCommercePlan` does — a price in the other mode is
                // invisible to checkout.
                livemode: plan.livemode
            });
            pricesCreated = 1;
        }
    }

    const counts = { plansPromoted: promoted.length, pricesCreated };
    const changed = promoted.length + pricesCreated > 0;

    const applied = changed
        ? `HOS-895 PR2: promoted "${PLAN_SLUG}" to active at ARS $45.000/mo with a 30-day trial${pricesCreated > 0 ? ' (monthly price row created)' : ''}.`
        : `HOS-895 PR2: "${PLAN_SLUG}" was already activated or operator-edited — no change.`;

    const manual =
        ' MANUAL STEP STILL PENDING (product decision, not this migration’s to make): checkout still resolves gastronomy to gastronomy-basico via resolveCommercePlanSlug / DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL — repoint HOSPEDA_COMMERCE_PLAN_SLUGS in Coolify (or ship a tier picker) before this plan is reachable by any real checkout. No MercadoPago action is needed: preapproval_plan provisioning is lazy and fires on that first checkout.';

    return {
        summary: `${applied}${manual}`,
        counts
    };
}
