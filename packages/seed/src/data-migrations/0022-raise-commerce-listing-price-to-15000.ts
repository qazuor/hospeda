/**
 * @fileoverview
 * Data migration: 0022-raise-commerce-listing-price-to-15000
 *
 * Raises the `commerce-listing` plan's ARS monthly price from the original
 * `500000` (ARS $5,000.00) placeholder to the owner-confirmed `1500000`
 * (ARS $15,000.00 — HOS-166 OQ-2, resolved 2026-07-15/22).
 *
 * ## Why this migration exists (Model C)
 *
 * `billing_plans.monthlyPriceArs` and `billing_prices.unitAmount` are both
 * classified `'commercial'` in
 * `packages/billing/src/config/model-c-field-split.ts` — the seed sync never
 * overwrites them once a value exists in the DB, and the commerce plan's own
 * seed (`packages/seed/src/required/commercePlan.seed.ts`) only INSERTs the
 * plan/price rows when they do not exist yet. So raising
 * `COMMERCE_LISTING_PLAN.monthlyPriceArs` in `plans.config.ts` alone corrects
 * only a FRESH `db:fresh`/`db:fresh-dev` run; any already-seeded environment
 * (staging/prod) keeps charging the `500000` placeholder forever without this
 * explicit, repeatable UPDATE.
 *
 * ## What it updates
 *
 * Both rows that carry the ARS price for the `commerce-listing` plan:
 *
 * 1. `billing_plans.monthlyPriceArs` (typed column, HOS-39 T-003) for the
 *    plan row matched by `name = 'commerce-listing'` (the slug — see
 *    `commercePlan.seed.ts`, which matches the same way).
 * 2. The sibling `billing_prices.unitAmount` row (`currency='ARS'`,
 *    `billingInterval='month'`, `intervalCount=1`) — the row MercadoPago
 *    actually reads for the recurring preapproval.
 *
 * `annualPriceArs` is untouched: the commerce plan has no annual price
 * (`annualPriceArs: null` in `plans.config.ts`), so no annual `billing_prices`
 * row exists to correct.
 *
 * ## Idempotency
 *
 * Both `UPDATE`s are guarded `WHERE ... = 500000` (via `eq(...,
 * OLD_PLACEHOLDER_ARS)`), matching §7.4's "Model-C-correct" guard: this only
 * ever moves the untouched placeholder value, and preserves any value an
 * operator already set through the SPEC-168 admin UI (which would no longer
 * equal `500000`). A second run — or a run against an environment where an
 * operator already repriced the plan — affects zero rows.
 *
 * Must not fail if the `commerce-listing` plan row does not exist yet on the
 * target environment — in that case this migration is a documented no-op;
 * `seedCommercePlan` will create the row at the corrected `1500000` amount
 * whenever it does run (the baseline was updated in the same PR).
 *
 * ## `destructive` flag decision
 *
 * `false`. This only UPDATEs two commercial-layer price fields, guarded to a
 * no-op once converged or once an operator has already overridden the price.
 * It never deletes data.
 */
import { and, billingPlans, billingPrices, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0022-raise-commerce-listing-price-to-15000',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The `billing_plans.name` (slug) this migration targets. */
const COMMERCE_PLAN_SLUG = 'commerce-listing';

/** The original placeholder ARS price, in centavos, this migration replaces. */
const OLD_PLACEHOLDER_ARS = 500000;

/** The owner-confirmed ARS price, in centavos, this migration converges to. */
const NEW_PRICE_ARS = 1500000;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    // ── Resolve the plan row (no-op if it does not exist yet) ────────────
    const existingPlan = await ctx.db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, COMMERCE_PLAN_SLUG))
        .limit(1);

    const planRow = existingPlan[0];
    if (!planRow) {
        return {
            summary: `Plan "${COMMERCE_PLAN_SLUG}" does not exist on this environment yet — nothing to update (seedCommercePlan will seed it at the correct amount whenever it runs).`,
            counts: { planRowsUpdated: 0, priceRowsUpdated: 0 }
        };
    }

    // ── Update the plan's typed monthlyPriceArs column when still at the
    //    original placeholder ───────────────────────────────────────────
    const updatedPlan = await ctx.db
        .update(billingPlans)
        .set({ monthlyPriceArs: NEW_PRICE_ARS })
        .where(
            and(
                eq(billingPlans.id, planRow.id),
                eq(billingPlans.monthlyPriceArs, OLD_PLACEHOLDER_ARS)
            )
        )
        .returning({ id: billingPlans.id });

    // ── Update the sibling monthly billing_prices row when still at the
    //    original placeholder ───────────────────────────────────────────
    const updatedPrice = await ctx.db
        .update(billingPrices)
        .set({ unitAmount: NEW_PRICE_ARS })
        .where(
            and(
                eq(billingPrices.planId, planRow.id),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, 'month'),
                eq(billingPrices.intervalCount, 1),
                eq(billingPrices.unitAmount, OLD_PLACEHOLDER_ARS)
            )
        )
        .returning({ id: billingPrices.id });

    return {
        summary: `Raised commerce-listing price to ${NEW_PRICE_ARS} centavos on ${updatedPlan.length} billing_plans row(s) and ${updatedPrice.length} billing_prices row(s) (rows already at the confirmed price or operator-overridden are left untouched).`,
        counts: { planRowsUpdated: updatedPlan.length, priceRowsUpdated: updatedPrice.length }
    };
}
