/**
 * @fileoverview
 * Data migration: 0090-hos-975-commerce-tier-prices
 *
 * Dual-write counterpart (HOS-25) for the HOS-975 baseline change: the owner
 * priced the six commerce tiers individually on 2026-09-03 and put the three
 * that were still dark on sale.
 *
 * | Plan | active before → after | ARS/mo before → after |
 * | --- | --- | --- |
 * | `gastronomy-basico`   | true → true      | $15.000 → **$30.000** |
 * | `gastronomy-pro`      | true → true      | $45.000 → **$65.000** |
 * | `gastronomy-premium`  | **false → true** | $15.000 → **$80.000** |
 * | `experience-basico`   | true → true      | $15.000 → $15.000 (UNCHANGED) |
 * | `experience-pro`      | **false → true** | unpriced (0) → **$35.000** |
 * | `experience-premium`  | **false → true** | $15.000 → **$50.000** |
 *
 * `experience-basico` is deliberately absent from this migration's work list.
 * Its price is the one the owner left where it was, so there is nothing to
 * converge — and listing it as a no-op transition would make a real future
 * change to it look like it had already been handled.
 *
 * ## Why the baseline edit alone is not enough
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * matches by `name` and INSERTS ONLY — an existing row is skipped wholesale,
 * and it explicitly "never overwrites a price an operator has since changed"
 * because `active` / `monthlyPriceArs` are `'commercial'` fields in Model C, so
 * the database wins. Editing `plans.config.ts` therefore only reaches a FRESH
 * `db:fresh` / `db:fresh-dev`; the already-seeded staging and production rows
 * would keep their old prices and their old `active` flags forever.
 *
 * ## Why BOTH the plan column and the price row move
 *
 * `billing_plans.monthly_price_ars` is what the admin surfaces and the public
 * plan list read; `billing_prices.unit_amount` is what CHECKOUT reads
 * (`findMonthlyPrice` in `apps/api/src/services/subscription-checkout.service.ts`,
 * which hard-throws `NO_MONTHLY_PRICE` when the row is missing and
 * `PLAN_NOT_PURCHASABLE` when it is zero). Moving only the column would advertise
 * the new price on the site and charge the old one — the exact divergence `0022`
 * had to fix for the pre-HOS-688 `commerce-listing` plan.
 *
 * `experience-pro` is the case where the two differ in KIND rather than in
 * value: it was seeded at `monthlyPriceArs: 0`, and `ensureCommercePlan` skips
 * the `billing_prices` row entirely for a tier priced at zero (a zero-amount
 * price reads as a free plan rather than an unpriced one). So it has no price
 * row to update — one is INSERTed, the same shape `0083` used when it activated
 * `gastronomy-pro`.
 *
 * ## MercadoPago — nothing to do by hand, and nothing charges the old amount
 *
 * `billing_mp_plans` keys a MercadoPago `preapproval_plan` on
 * `(commercial_plan_id, billing_interval, trial_days, discount_cycle1_amount)`
 * and stores `amount_ars` as a DRIFT SNAPSHOT, not as part of the key.
 * `resolveOrProvisionMpPlan`
 * (`apps/api/src/services/billing/mp-plan-provisioning.service.ts`) compares that
 * snapshot against the amount the checkout resolved from `billing_prices`: when
 * they differ it creates a FRESH `preapproval_plan` at the current amount,
 * archives the stale one and swaps the registry row. So a repriced tier
 * re-provisions itself on the next checkout that reaches it, and no manual
 * MercadoPago work is required by this migration or by the deploy that carries
 * it. Subscriptions already authorized keep the amount they were authorized at —
 * which is moot here: production held ZERO commerce subscriptions when this was
 * decided (measured 2026-09-03), so there is no old price to honour and no
 * grandfathering anywhere in this change.
 *
 * ## What it does NOT do
 *
 * It does not repoint `HOSPEDA_COMMERCE_PLAN_SLUGS`. Activating a tier makes it
 * a valid subscription target; which tier a checkout that picks NOTHING lands on
 * is still `DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL` (both `-basico`) or that env
 * override, and no environment moves because of this migration. Since HOS-1119 a
 * buyer who DOES pick reaches any tier of their vertical through
 * `requestedPlanSlug`, which is what makes activation matter at all.
 *
 * ## OR-PRESERVE semantics
 *
 * Every UPDATE is guarded on the row still holding its EXACT old baseline (both
 * the old `active` flag and the old price), so an operator who already repriced
 * or enabled a tier through the admin editor is left alone, and a re-run against
 * an already-migrated database affects zero rows. The price-row write is
 * resolved from a fresh read of the plan rather than from the UPDATE's result,
 * so a re-run also repairs a half-applied state where the plan moved but the
 * price row did not. A plan row absent from this environment is a documented
 * no-op — `seedCommercePlan` will create it at the new values on its next run.
 *
 * The summary reports a per-plan verdict rather than a single total on purpose:
 * every guard here can legitimately match zero rows, and a bare `0` is
 * indistinguishable from a migration that silently found nothing to do.
 *
 * ## `destructive` flag decision
 *
 * `false`. Five guarded UPDATEs on five well-identified plan rows, four guarded
 * price UPDATEs and one additive price INSERT. No deletes, no repointing of any
 * subscription. Reversible by moving the amounts back and flipping the three
 * `active` flags.
 */
import { and, billingPlans, billingPrices, eq, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0090-hos-975-commerce-tier-prices',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/** The 30-day trial every sellable commerce tier carries (`COMMERCE_TRIAL_DAYS`). */
const COMMERCE_TRIAL_DAYS = 30;

/** One tier's move, exactly as `plans.config.ts` now declares it. */
interface TierTransition {
    /** `billing_plans.name` (the slug). */
    readonly slug: string;
    /** The `active` value this row must still hold for the migration to move it. */
    readonly oldActive: boolean;
    /** The `monthly_price_ars` this row must still hold, in centavos. */
    readonly oldPriceArs: number;
    /** The `active` value to converge to. */
    readonly newActive: boolean;
    /** The `monthly_price_ars` / `unit_amount` to converge to, in centavos. */
    readonly newPriceArs: number;
    /**
     * Whether this tier also gains the 30-day trial in `metadata`. Only
     * `experience-pro`: it is the last tier that carried the `hasTrial: false`
     * default, which only ever meant "not sellable yet".
     */
    readonly grantsTrial: boolean;
}

/**
 * The five tiers that move. `experience-basico` is absent by decision — see the
 * file docblock.
 */
const TRANSITIONS: readonly TierTransition[] = [
    {
        slug: 'gastronomy-basico',
        oldActive: true,
        oldPriceArs: 1_500_000,
        newActive: true,
        newPriceArs: 3_000_000,
        grantsTrial: false
    },
    {
        slug: 'gastronomy-pro',
        oldActive: true,
        oldPriceArs: 4_500_000,
        newActive: true,
        newPriceArs: 6_500_000,
        grantsTrial: false
    },
    {
        slug: 'gastronomy-premium',
        oldActive: false,
        oldPriceArs: 1_500_000,
        newActive: true,
        newPriceArs: 8_000_000,
        grantsTrial: false
    },
    {
        slug: 'experience-pro',
        oldActive: false,
        oldPriceArs: 0,
        newActive: true,
        newPriceArs: 3_500_000,
        grantsTrial: true
    },
    {
        slug: 'experience-premium',
        oldActive: false,
        oldPriceArs: 1_500_000,
        newActive: true,
        newPriceArs: 5_000_000,
        grantsTrial: false
    }
];

/** What happened to one tier, for the human-readable summary. */
type TierVerdict = 'converged' | 'already-converged-or-operator-edited' | 'absent';

/** Row counts and verdict contributed by one tier. */
interface TransitionOutcome {
    readonly verdict: TierVerdict;
    readonly plansUpdated: number;
    readonly pricesUpdated: number;
}

/**
 * Applies one tier's transition: the guarded plan-row UPDATE, then the monthly
 * ARS price row checkout actually reads.
 *
 * @param ctx - The seed-migration context.
 * @param transition - The tier move to apply.
 * @returns The verdict plus the row counts this tier contributed.
 */
async function applyTransition(
    ctx: SeedMigrationCtx,
    transition: TierTransition
): Promise<TransitionOutcome> {
    // ── 1. Converge the plan row, only from its exact old baseline ───────────
    const metadataPatch = transition.grantsTrial
        ? sql`${billingPlans.metadata} || jsonb_build_object('monthlyPriceArs', ${transition.newPriceArs}::int, 'hasTrial', true, 'trialDays', ${COMMERCE_TRIAL_DAYS}::int)`
        : sql`${billingPlans.metadata} || jsonb_build_object('monthlyPriceArs', ${transition.newPriceArs}::int)`;

    const promoted = await ctx.db
        .update(billingPlans)
        .set({
            active: transition.newActive,
            monthlyPriceArs: transition.newPriceArs,
            metadata: metadataPatch,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingPlans.name, transition.slug),
                // OR-PRESERVE: both halves of the old baseline. An operator who
                // already repriced OR already enabled this tier made a decision
                // this migration must not overwrite.
                eq(billingPlans.active, transition.oldActive),
                sql`COALESCE(${billingPlans.monthlyPriceArs}, 0) = ${transition.oldPriceArs}`
            )
        )
        .returning({ name: billingPlans.name });

    // Re-read rather than trusting step 1: the row may have been converged just
    // now, converged by an earlier run, operator-edited, or absent entirely.
    const planRows = await ctx.db
        .select({
            id: billingPlans.id,
            monthlyPriceArs: billingPlans.monthlyPriceArs,
            livemode: billingPlans.livemode
        })
        .from(billingPlans)
        .where(eq(billingPlans.name, transition.slug))
        .limit(1);

    const plan = planRows[0];
    if (!plan) {
        return { verdict: 'absent', plansUpdated: 0, pricesUpdated: 0 };
    }

    // ── 2. Converge the monthly ARS price row checkout actually reads ────────
    // Only when the plan itself now sits at the new price. If it does not, the
    // row was operator-edited and its price row belongs to that operator too.
    let pricesUpdated = 0;
    if (plan.monthlyPriceArs === transition.newPriceArs) {
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

        const priceRow = existingPrices[0];
        if (priceRow) {
            const updatedPrice = await ctx.db
                .update(billingPrices)
                .set({ unitAmount: transition.newPriceArs })
                .where(
                    and(
                        eq(billingPrices.id, priceRow.id),
                        // Same OR-PRESERVE guard: move it only from the old
                        // amount. Already at the new one → zero rows, which is
                        // exactly what a re-run should do.
                        eq(billingPrices.unitAmount, transition.oldPriceArs)
                    )
                )
                .returning({ id: billingPrices.id });
            pricesUpdated = updatedPrice.length;
        } else {
            // `experience-pro`'s case: seeded unpriced, so `ensureCommercePlan`
            // never created a price row. Without one the first real buyer gets
            // `NO_MONTHLY_PRICE`, so activation without this insert sells nothing.
            await ctx.db.insert(billingPrices).values({
                planId: plan.id,
                currency: 'ARS',
                unitAmount: transition.newPriceArs,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                // Mirrors the plan row's own livemode, exactly as
                // `ensureCommercePlan` does — a price in the other mode is
                // invisible to checkout.
                livemode: plan.livemode
            });
            pricesUpdated = 1;
        }
    }

    const verdict: TierVerdict =
        promoted.length + pricesUpdated > 0 ? 'converged' : 'already-converged-or-operator-edited';

    return { verdict, plansUpdated: promoted.length, pricesUpdated };
}

/**
 * Runs the HOS-975 commerce repricing/activation against an already-seeded
 * environment.
 *
 * @param ctx - The seed-migration context.
 * @returns A per-tier summary plus the total plan and price rows moved.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const verdicts: string[] = [];
    let plansUpdated = 0;
    let pricesUpdated = 0;

    for (const transition of TRANSITIONS) {
        const outcome = await applyTransition(ctx, transition);
        plansUpdated += outcome.plansUpdated;
        pricesUpdated += outcome.pricesUpdated;
        verdicts.push(`${transition.slug}: ${outcome.verdict}`);
    }

    return {
        summary: `HOS-975: converged the commerce tier prices and activated gastronomy-premium / experience-pro / experience-premium. Per tier — ${verdicts.join('; ')}. experience-basico is unchanged by decision (stays ARS $15.000). No MercadoPago action needed: preapproval_plan provisioning is lazy and drift-driven (resolveOrProvisionMpPlan compares billing_mp_plans.amount_ars against the checkout amount), so the next checkout on a repriced tier creates a fresh preapproval_plan at the new amount and archives the stale one.`,
        counts: { plansUpdated, pricesUpdated }
    };
}
