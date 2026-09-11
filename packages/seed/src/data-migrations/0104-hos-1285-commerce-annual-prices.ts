/**
 * @fileoverview
 * Data migration: 0104-hos-1285-commerce-annual-prices
 *
 * Dual-write counterpart (HOS-25) for the HOS-1285 baseline change: the six
 * commerce tiers gained an annual price, at the owner's ten-for-twelve rule —
 * ten months charged for twelve served, the same discount accommodation uses.
 *
 * | Plan | ARS/mo | annual before → after |
 * | --- | --- | --- |
 * | `gastronomy-basico`   | $30.000 | NULL → **$300.000** |
 * | `gastronomy-pro`      | $65.000 | NULL → **$650.000** |
 * | `gastronomy-premium`  | $80.000 | NULL → **$800.000** |
 * | `experience-basico`   | $15.000 | NULL → **$150.000** |
 * | `experience-pro`      | $35.000 | NULL → **$350.000** |
 * | `experience-premium`  | $50.000 | NULL → **$500.000** |
 *
 * ## Why the baseline edit alone is not enough
 *
 * `annualPriceArs` is a `'commercial'` field in `MODEL_C_FIELD_SPLIT`, so
 * `ensurePlan` preserves the DATABASE value on an existing row: editing
 * `plans.config.ts` reaches a fresh `db:fresh` / `db:fresh-dev` and nothing
 * else. `seedCommercePlan`'s new annual price row has the same shape of
 * limitation on the price side — it INSERTS only when no `'year'` row exists,
 * which is true here, but it never runs against staging/production between
 * deploys. Both halves therefore need this migration.
 *
 * ## Why BOTH the plan column and the price row move
 *
 * `billing_plans.annual_price_ars` is what the admin surfaces, the public plan
 * list and the web pricing cards read — `PricingCardsGrid.astro`'s
 * `hasAnyAnnualPrice` gate is literally what makes the monthly/annual toggle
 * appear on `/planes/gastronomia/precios/` and its experiences sibling.
 * `billing_prices.unit_amount` at `billing_interval = 'year'` is what CHECKOUT
 * reads (`findAnnualPrice` in
 * `apps/api/src/services/subscription-checkout.service.ts`, which hard-throws
 * `NO_ANNUAL_PRICE` when the row is missing and `PLAN_NOT_PURCHASABLE` when it
 * is zero). Moving only the column would advertise an annual plan the checkout
 * cannot sell — the mirror image of the divergence `0090` had to fix on the
 * monthly side.
 *
 * ## MercadoPago — nothing to do by hand
 *
 * `billing_mp_plans` keys a `preapproval_plan` on
 * `(commercial_plan_id, billing_interval, trial_days, discount_cycle1_amount)`,
 * so the ANNUAL variant of a commerce plan is a key that has never been
 * resolved and simply does not exist yet. `resolveOrProvisionMpPlan` creates it
 * on the first annual checkout that reaches it. No existing monthly
 * `preapproval_plan` is touched, and no already-authorized subscription changes
 * cadence: an annual subscription is only ever born from a checkout that asks
 * for one.
 *
 * ## OR-PRESERVE semantics
 *
 * The plan UPDATE is guarded on `annual_price_ars IS NULL`, so an operator who
 * already set an annual price through the admin editor is left alone and a
 * re-run affects zero rows. The price INSERT is guarded on the absence of a
 * `('ARS', 'year', 1)` row for that plan, so a re-run inserts nothing and a
 * half-applied state (column moved, row missing) is repaired. A plan row absent
 * from this environment is a documented no-op — `seedCommercePlan` will create
 * it with both price rows on its next run.
 *
 * The summary reports a per-plan verdict rather than a single total, for the
 * reason `0090` states: every guard here can legitimately match zero rows, and
 * a bare `0` is indistinguishable from a migration that silently found nothing
 * to do.
 *
 * ## `destructive` flag decision
 *
 * `false`. Six guarded UPDATEs on six well-identified plan rows and six guarded
 * additive price INSERTs. No deletes, no repointing of any subscription, and no
 * existing price row is read or rewritten. Reversible by nulling the column and
 * deleting the `'year'` rows.
 */
import { and, billingPlans, billingPrices, eq, isNull, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0104-hos-1285-commerce-annual-prices',
    group: 'required',
    destructive: false,
    // The one column this migration cannot do without. `annual_price_ars` is a
    // typed Drizzle column (HOS-39 T-003/T-005), promoted off
    // `metadata.annualPriceArs`; without it every UPDATE here is a no-op that
    // would still be ledgered as applied forever — the HOS-433 shape. The
    // runner only refuses when the column is missing AND the table still holds
    // rows, so an absent column over an empty `billing_plans` loses nothing.
    requiresColumns: [{ table: 'billing_plans', column: 'annual_price_ars' }]
} as const satisfies SeedMigrationModule['meta'];

/** One tier's annual price, exactly as `plans.config.ts` now declares it. */
interface AnnualPrice {
    /** `billing_plans.name` (the slug). */
    readonly slug: string;
    /** The `annual_price_ars` / `unit_amount` to converge to, in centavos. */
    readonly annualPriceArs: number;
}

/**
 * All six tiers. None is absent by decision: unlike `0090`'s repricing, where
 * `experience-basico` was deliberately left where it was, every commerce tier
 * moves from "no annual option at all" to one.
 */
const ANNUAL_PRICES: readonly AnnualPrice[] = [
    { slug: 'gastronomy-basico', annualPriceArs: 30_000_000 },
    { slug: 'gastronomy-pro', annualPriceArs: 65_000_000 },
    { slug: 'gastronomy-premium', annualPriceArs: 80_000_000 },
    { slug: 'experience-basico', annualPriceArs: 15_000_000 },
    { slug: 'experience-pro', annualPriceArs: 35_000_000 },
    { slug: 'experience-premium', annualPriceArs: 50_000_000 }
];

/** What happened to one tier, for the human-readable summary. */
type TierVerdict = 'converged' | 'already-converged-or-operator-edited' | 'absent';

/** Row counts and verdict contributed by one tier. */
interface AnnualPriceOutcome {
    readonly verdict: TierVerdict;
    readonly plansUpdated: number;
    readonly pricesInserted: number;
}

/**
 * Applies one tier's annual price: the guarded plan-column UPDATE, then the
 * `'year'` `billing_prices` row checkout actually reads.
 *
 * @param ctx - The seed-migration context.
 * @param target - The tier and the annual amount to converge to.
 * @returns The verdict plus the row counts this tier contributed.
 */
async function applyAnnualPrice(
    ctx: SeedMigrationCtx,
    target: AnnualPrice
): Promise<AnnualPriceOutcome> {
    // ── 1. Converge the plan column, only from "no annual option" ────────────
    const promoted = await ctx.db
        .update(billingPlans)
        .set({
            annualPriceArs: target.annualPriceArs,
            metadata: sql`${billingPlans.metadata} || jsonb_build_object('annualPriceArs', ${target.annualPriceArs}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingPlans.name, target.slug),
                // OR-PRESERVE: an operator who already priced this tier annually
                // made a decision this migration must not overwrite.
                isNull(billingPlans.annualPriceArs)
            )
        )
        .returning({ name: billingPlans.name });

    // Re-read rather than trusting step 1: the row may have been converged just
    // now, converged by an earlier run, operator-edited, or absent entirely.
    const planRows = await ctx.db
        .select({
            id: billingPlans.id,
            annualPriceArs: billingPlans.annualPriceArs,
            livemode: billingPlans.livemode
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, target.slug))
        .limit(1);

    const plan = planRows[0];
    if (!plan) {
        return { verdict: 'absent', plansUpdated: 0, pricesInserted: 0 };
    }

    // ── 2. The annual price row checkout actually reads ──────────────────────
    // Inserted at whatever the PLAN column now holds, not at `target`: if an
    // operator had already set their own annual price, step 1 left it alone and
    // the price row must agree with THAT, never with the config figure.
    let pricesInserted = 0;
    const planAnnual = plan.annualPriceArs;
    if (planAnnual !== null && planAnnual > 0) {
        const existingAnnual = await ctx.db
            .select({ id: billingPrices.id })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, plan.id),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'year'),
                    eq(billingPrices.intervalCount, 1)
                )
            )
            .limit(1);

        if (existingAnnual.length === 0) {
            await ctx.db.insert(billingPrices).values({
                planId: plan.id,
                currency: 'ARS',
                unitAmount: planAnnual,
                billingInterval: 'year',
                intervalCount: 1,
                active: true,
                // Mirrors the plan row's own livemode, exactly as
                // `ensureCommercePriceRow` does — a price in the other mode is
                // invisible to checkout.
                livemode: plan.livemode
            });
            pricesInserted = 1;
        }
    }

    const verdict: TierVerdict =
        promoted.length + pricesInserted > 0 ? 'converged' : 'already-converged-or-operator-edited';

    return { verdict, plansUpdated: promoted.length, pricesInserted };
}

/**
 * Gives every already-seeded commerce tier the annual price HOS-1285 added to
 * the baseline, plus the `'year'` price row that makes it buyable.
 *
 * @param ctx - The seed-migration context.
 * @returns A per-tier summary plus the total plan and price rows moved.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const verdicts: string[] = [];
    let plansUpdated = 0;
    let pricesInserted = 0;

    for (const target of ANNUAL_PRICES) {
        const outcome = await applyAnnualPrice(ctx, target);
        plansUpdated += outcome.plansUpdated;
        pricesInserted += outcome.pricesInserted;
        verdicts.push(`${target.slug}: ${outcome.verdict}`);
    }

    return {
        summary: `HOS-1285: gave the six commerce tiers an annual price (ten months charged for twelve served) plus the 'year' billing_prices row checkout resolves. Per tier — ${verdicts.join('; ')}. No MercadoPago action needed: the annual preapproval_plan variant is a billing_mp_plans key that has never been resolved, and resolveOrProvisionMpPlan creates it on the first annual checkout.`,
        counts: { plansUpdated, pricesInserted }
    };
}
