/**
 * @fileoverview
 * Data migration: 0049-hos-301-reprice-owner-plans
 *
 * Applies the HOS-301 D1 owner-plan repricing decision (owner-confirmed
 * 2026-08-11) to already-seeded environments:
 *
 * | Plan            | Monthly            | Annual                 |
 * | --------------- | ------------------ | ---------------------- |
 * | `owner-basico`  | $15,000 → $18,000  | $150,000 → $180,000    |
 * | `owner-premium` | $75,000 → $65,000  | $750,000 → $650,000    |
 *
 * `owner-pro` is deliberately untouched — D1 confirmed its current amounts.
 * Both annual prices stay at the "10 months" ratio the plan copy advertises
 * (two months free).
 *
 * ## Why this migration exists (Model C)
 *
 * `monthlyPriceArs`, `annualPriceArs` and `billing_prices.unitAmount` are all
 * classified `'commercial'` in
 * `packages/billing/src/config/model-c-field-split.ts`: the seed sync never
 * overwrites them once the DB holds a value, because price is an operator
 * decision and the DB wins. Editing `plans.config.ts` alone therefore only
 * corrects a fresh `db:fresh`/`db:fresh-dev`; staging and production would keep
 * charging the old amounts forever. Same reasoning — and same shape — as
 * `0022-raise-commerce-listing-price-to-15000.ts`.
 *
 * ## What it updates
 *
 * Three carriers per plan, matching every location the SPEC-168 admin update
 * path writes (`plan.crud.ts` → `updatePlan`), so a migrated DB is
 * indistinguishable from an operator-edited one:
 *
 * 1. `billing_plans.monthlyPriceArs` / `annualPriceArs` (typed columns, HOS-73).
 * 2. `billing_plans.metadata.{monthlyPriceArs,annualPriceArs,monthlyPriceUsdRef}`
 *    (the JSONB mirror the seeder writes at INSERT).
 * 3. The active `billing_prices.unitAmount` rows (`currency='ARS'`,
 *    `intervalCount=1`) for `billingInterval='month'` and `'year'`.
 *
 * Carrier 3 is the load-bearing one: `mapDbToPlan()` reads the PUBLIC price off
 * `billing_prices.unitAmount`, not off the typed column — so skipping it would
 * leave `GET /api/v1/public/plans` (and therefore the pricing page) serving the
 * old amount even with the plan row updated.
 *
 * ## Idempotency
 *
 * Every write is guarded on the exact old value (`WHERE ... = OLD`), per field
 * and per carrier. Consequences, all intended:
 *
 * - A second run affects zero rows.
 * - A value an operator already changed through the admin UI is left alone —
 *   it no longer equals the old amount, so no guard matches.
 * - A plan row absent from the target environment is a documented no-op; the
 *   baseline (updated in this same PR, per the HOS-25 dual-write rule) seeds it
 *   at the new amount whenever it first runs.
 *
 * ## MercadoPago
 *
 * Out of scope, deliberately. This migration only moves catalog prices;
 * existing subscribers keep their MercadoPago preapproval amount untouched.
 * Re-pricing live preapprovals is HOS-176's flow (D-3 notice, grandfathering)
 * and is gated behind `HOSPEDA_BILLING_PRICE_INCREASE_ENABLED`.
 *
 * ## `destructive` flag decision
 *
 * `false`. Guarded UPDATEs on commercial price fields only — no deletes, and a
 * no-op once converged or once an operator has overridden the amount.
 */
import { and, billingPlans, billingPrices, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0049-hos-301-reprice-owner-plans',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * One owner plan's repricing, expressed as old → new so every write can be
 * guarded on the old value.
 *
 * Amounts are in ARS centavos; `usdRef` is the display-only USD reference the
 * public plans endpoint echoes from `metadata.monthlyPriceUsdRef`.
 */
type PlanRepricing = {
    readonly slug: string;
    readonly oldMonthlyArs: number;
    readonly newMonthlyArs: number;
    readonly oldAnnualArs: number;
    readonly newAnnualArs: number;
    readonly oldUsdRef: number;
    readonly newUsdRef: number;
};

/** The HOS-301 D1 grid. `owner-pro` is absent on purpose: D1 left it unchanged. */
const REPRICINGS: readonly PlanRepricing[] = [
    {
        slug: 'owner-basico',
        oldMonthlyArs: 1500000,
        newMonthlyArs: 1800000,
        oldAnnualArs: 15000000,
        newAnnualArs: 18000000,
        oldUsdRef: 15,
        newUsdRef: 18
    },
    {
        slug: 'owner-premium',
        oldMonthlyArs: 7500000,
        newMonthlyArs: 6500000,
        oldAnnualArs: 75000000,
        newAnnualArs: 65000000,
        oldUsdRef: 75,
        newUsdRef: 65
    }
];

/**
 * Updates the active ARS `billing_prices` row for one interval, guarded on the
 * old amount.
 *
 * @returns Number of price rows actually updated (0 or 1).
 */
async function repriceInterval(input: {
    readonly ctx: SeedMigrationCtx;
    readonly planId: string;
    readonly billingInterval: 'month' | 'year';
    readonly oldAmount: number;
    readonly newAmount: number;
}): Promise<number> {
    const { ctx, planId, billingInterval, oldAmount, newAmount } = input;

    const updated = await ctx.db
        .update(billingPrices)
        .set({ unitAmount: newAmount })
        .where(
            and(
                eq(billingPrices.planId, planId),
                eq(billingPrices.currency, 'ARS'),
                eq(billingPrices.billingInterval, billingInterval),
                eq(billingPrices.intervalCount, 1),
                eq(billingPrices.unitAmount, oldAmount)
            )
        )
        .returning({ id: billingPrices.id });

    return updated.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let plansUpdated = 0;
    let metadataUpdated = 0;
    let priceRowsUpdated = 0;
    const skipped: string[] = [];

    for (const plan of REPRICINGS) {
        const existing = await ctx.db
            .select({
                id: billingPlans.id,
                monthlyPriceArs: billingPlans.monthlyPriceArs,
                annualPriceArs: billingPlans.annualPriceArs,
                metadata: billingPlans.metadata
            })
            .from(billingPlans)
            .where(eq(billingPlans.name, plan.slug))
            .limit(1);

        const planRow = existing[0];
        if (!planRow) {
            skipped.push(plan.slug);
            continue;
        }

        // ── Carrier 1: typed columns, each guarded independently so a
        //    partially operator-edited plan still converges on the other field.
        const columnPatch: { monthlyPriceArs?: number; annualPriceArs?: number } = {};
        if (planRow.monthlyPriceArs === plan.oldMonthlyArs) {
            columnPatch.monthlyPriceArs = plan.newMonthlyArs;
        }
        if (planRow.annualPriceArs === plan.oldAnnualArs) {
            columnPatch.annualPriceArs = plan.newAnnualArs;
        }

        // ── Carrier 2: the JSONB mirror. Same per-field guard; merged onto the
        //    existing metadata so unrelated commercial sub-fields survive.
        const currentMeta = (planRow.metadata ?? {}) as Record<string, unknown>;
        const metaPatch: Record<string, number> = {};
        if (currentMeta.monthlyPriceArs === plan.oldMonthlyArs) {
            metaPatch.monthlyPriceArs = plan.newMonthlyArs;
        }
        if (currentMeta.annualPriceArs === plan.oldAnnualArs) {
            metaPatch.annualPriceArs = plan.newAnnualArs;
        }
        if (currentMeta.monthlyPriceUsdRef === plan.oldUsdRef) {
            metaPatch.monthlyPriceUsdRef = plan.newUsdRef;
        }

        const hasColumnPatch = Object.keys(columnPatch).length > 0;
        const hasMetaPatch = Object.keys(metaPatch).length > 0;

        if (hasColumnPatch || hasMetaPatch) {
            // Merge only the patched keys server-side (`||` + jsonb_build_object,
            // as in `0017-hos-210-tourist-plan-trial.ts`) instead of rewriting the
            // whole blob from the value we just read — any sub-field written
            // between this SELECT and UPDATE survives.
            const metaMergePairs = Object.entries(metaPatch).map(
                ([key, value]) => sql`${key}::text, ${value}::int`
            );

            await ctx.db
                .update(billingPlans)
                .set({
                    ...columnPatch,
                    ...(hasMetaPatch
                        ? {
                              metadata: sql`${billingPlans.metadata} || jsonb_build_object(${sql.join(metaMergePairs, sql`, `)})`
                          }
                        : {}),
                    updatedAt: new Date()
                })
                .where(eq(billingPlans.id, planRow.id));

            if (hasColumnPatch) {
                plansUpdated++;
            }
            if (hasMetaPatch) {
                metadataUpdated++;
            }
        }

        // ── Carrier 3: the price rows the public endpoint actually reads.
        priceRowsUpdated += await repriceInterval({
            ctx,
            planId: planRow.id,
            billingInterval: 'month',
            oldAmount: plan.oldMonthlyArs,
            newAmount: plan.newMonthlyArs
        });
        priceRowsUpdated += await repriceInterval({
            ctx,
            planId: planRow.id,
            billingInterval: 'year',
            oldAmount: plan.oldAnnualArs,
            newAmount: plan.newAnnualArs
        });
    }

    const skippedNote =
        skipped.length > 0 ? ` Plans absent from this environment: ${skipped.join(', ')}.` : '';

    return {
        summary: `HOS-301 D1 owner repricing: updated ${plansUpdated} plan row(s), ${metadataUpdated} metadata mirror(s) and ${priceRowsUpdated} price row(s). Values already converged or operator-overridden were left untouched.${skippedNote}`,
        counts: { plansUpdated, metadataUpdated, priceRowsUpdated, plansSkipped: skipped.length }
    };
}
