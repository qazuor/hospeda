/**
 * @fileoverview
 * Data migration: 0071-hos-818-commerce-sellable-tier-basico
 *
 * Dual-write counterpart (HOS-25) for the HOS-818 baseline change: the sellable
 * tier of both commerce verticals moves from `*-premium` to `*-basico`.
 *
 * ## Why
 *
 * Owner decision (HOS-818): reserve the "premium" name for a future step that
 * actually carries more functionality, and put today's buyers on the entry tier
 * instead of on the top one with nowhere left to go. The two tiers are already
 * IDENTICAL in everything a payer can perceive — same price
 * (`COMMERCE_VERTICAL_MONTHLY_PRICE_ARS`), same limit (one listing), same
 * (empty) entitlement set — so this changes the name and nothing else.
 *
 * ## Why the baseline edit alone is not enough
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * matches by `name` and INSERTS ONLY — an existing row is skipped wholesale, and
 * `active` / `monthlyPriceArs` / `metadata` are `'commercial'` fields in Model C,
 * so the database wins. Editing `GASTRONOMY_BASICO_PLAN` /
 * `EXPERIENCE_BASICO_PLAN` in `packages/billing/src/config/plans.config.ts`
 * therefore only reaches a FRESH `db:fresh` / `db:fresh-dev`; the already-seeded
 * staging and production rows (`*-basico`: inactive, priced 0, no trial) would
 * never receive it.
 *
 * ## What it does
 *
 * 1. **Promotes both `*-basico` rows**: `active = true`, `monthly_price_ars`
 *    (column and metadata mirror) to the sellable price, and
 *    `metadata.hasTrial` / `metadata.trialDays` to the same 30-day card-first
 *    trial the premium tier carried (HOS-590) — without which the rename would
 *    silently take the trial away from every new buyer.
 * 2. **Creates the missing monthly `billing_prices` row** for each promoted
 *    plan. The seed skipped it (`monthlyPriceArs <= 0` → "unpriced tier"), and
 *    checkout resolves the PRICE row, not the plan column: `NO_MONTHLY_PRICE` is
 *    a hard throw in `initiateCommerceMonthlySubscription`. Without this step the
 *    rename would take both verticals offline.
 * 3. **Retires both `*-premium` rows**: `active = false`, and nothing else.
 *    Their price rows, metadata and MercadoPago `preapproval_plan`s are left
 *    completely alone — live subscriptions hang off those plans (HOS-818: "do
 *    NOT delete or deactivate the preapproval_plan in the MercadoPago panel").
 * 4. **Repoints LIVE subscriptions** from the premium plan to its basic
 *    counterpart. Scoped to non-terminal statuses on purpose: a cancelled or
 *    expired row is a historical record of what that customer actually bought,
 *    and rewriting it would falsify the archive to no one's benefit.
 *
 * ## MercadoPago
 *
 * Nothing to provision and nothing to revoke. `billing_mp_plans` is keyed on
 * `(commercialPlanId, billingInterval, trialDays, discountCycle1AmountCentavos)`
 * — the plan NAME is not part of that key — and provisioning is lazy, so the
 * first checkout after this migration mints a NEW `preapproval_plan` for the
 * basic plan on its own. Existing preapprovals keep charging against the plan
 * they were created under, which is exactly why step 3 only flips a flag.
 *
 * ## Manual step this migration cannot perform
 *
 * The API's commerce plan-slug environment variable is set EXPLICITLY on staging
 * and production, and an explicit value WINS over
 * `DEFAULT_COMMERCE_PLAN_SLUG_BY_VERTICAL`. It must be repointed at the two
 * `*-basico` slugs in Coolify, or checkout keeps resolving the (now inactive)
 * premium plans after this migration runs — the rows move and the sale does not.
 *
 * The variable is named in `@repo/config`'s env registry and in the HOS-818 PR
 * body rather than spelled out here: a static guard
 * (`scripts/check-commerce-plan-resolution.sh`) fails on any file outside the
 * resolver that mentions it, so that a second module can never quietly grow its
 * own vertical→slug resolution. Naming it in prose would trip that guard for no
 * gain, since this migration neither reads nor can read it.
 *
 * ## OR-PRESERVE semantics
 *
 * Every UPDATE is guarded on the row still holding the exact OLD baseline value,
 * so an operator who already edited a plan through the admin editor is left
 * alone, and a re-run against an already-migrated database is a no-op (zero
 * affected rows). The price insert is guarded on absence, and resolved from a
 * fresh read rather than from step 1's result, so a re-run also repairs a
 * half-applied state where the plan was promoted but the insert did not land.
 *
 * ## `destructive` flag decision
 *
 * `false`. No deletes. Guarded UPDATEs on four well-identified plan rows plus one
 * additive price row per vertical. Reversible by flipping `active` back and
 * repointing the same subscriptions; the premium rows are otherwise untouched.
 */
import {
    and,
    billingPlans,
    billingPrices,
    billingSubscriptions,
    eq,
    inArray,
    isNull,
    sql
} from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0071-hos-818-commerce-sellable-tier-basico',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The vertical pairs this migration retiers, as `billing_plans.name` (the slug).
 *
 * Literals rather than imports from `@repo/billing`: a migration records the
 * delta it applied on the day it ran, so it must keep describing that delta even
 * after a later baseline change moves the constants underneath it.
 */
const TIER_PAIRS = [
    { basico: 'gastronomy-basico', premium: 'gastronomy-premium' },
    { basico: 'experience-basico', premium: 'experience-premium' }
] as const;

/** Post-HOS-818 values for the promoted basic tier (mirrors `plans.config.ts`). */
const NEW_MONTHLY_PRICE_ARS = 1_500_000;
const NEW_HAS_TRIAL = true;
const NEW_TRIAL_DAYS = 30;

/**
 * Subscription statuses whose `plan_id` is still commercially live and therefore
 * worth repointing. Terminal states are deliberately excluded — see the header.
 */
const LIVE_SUBSCRIPTION_STATUSES = [
    'active',
    'trialing',
    'past_due',
    'paused',
    'pending_provider',
    'incomplete'
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const basicoNames = TIER_PAIRS.map((pair) => pair.basico);
    const premiumNames = TIER_PAIRS.map((pair) => pair.premium);

    // ── 1. Promote both `*-basico` rows to the sellable configuration ────────
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
                inArray(billingPlans.name, [...basicoNames]),
                // OR-PRESERVE: only a row still at the pre-HOS-818 baseline
                // (inactive AND unpriced). An operator who already priced or
                // enabled it made a decision this migration must not overwrite.
                eq(billingPlans.active, false),
                sql`COALESCE(${billingPlans.monthlyPriceArs}, 0) = 0`
            )
        )
        .returning({ name: billingPlans.name });

    // ── 2. Give each now-sellable plan its monthly ARS price row ─────────────
    const basicoPlans = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            livemode: billingPlans.livemode
        })
        .from(billingPlans)
        .where(and(inArray(billingPlans.name, [...basicoNames]), eq(billingPlans.active, true)));

    let pricesCreated = 0;
    for (const plan of basicoPlans) {
        const existingPrice = await ctx.db
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

        if (existingPrice.length > 0) {
            continue;
        }

        await ctx.db.insert(billingPrices).values({
            planId: plan.id,
            currency: 'ARS',
            unitAmount: NEW_MONTHLY_PRICE_ARS,
            billingInterval: 'month',
            intervalCount: 1,
            active: true,
            // Mirrors the plan row's own livemode, exactly as `ensureCommercePlan`
            // does — a price in the other mode is invisible to checkout.
            livemode: plan.livemode
        });
        pricesCreated += 1;
    }

    // ── 3. Retire both `*-premium` rows (flag only — see the header) ─────────
    const retired = await ctx.db
        .update(billingPlans)
        .set({ active: false, updatedAt: new Date() })
        .where(and(inArray(billingPlans.name, [...premiumNames]), eq(billingPlans.active, true)))
        .returning({ name: billingPlans.name });

    // ── 4. Repoint live subscriptions premium → basico, per vertical ─────────
    // Per pair rather than in one statement: the gastronomy premium must land on
    // the gastronomy basic plan, never on the experience one.
    let subscriptionsRepointed = 0;
    for (const pair of TIER_PAIRS) {
        const rows = await ctx.db
            .select({ id: billingPlans.id, name: billingPlans.name })
            .from(billingPlans)
            .where(inArray(billingPlans.name, [pair.basico, pair.premium]));

        const basicoId = rows.find((row) => row.name === pair.basico)?.id;
        const premiumId = rows.find((row) => row.name === pair.premium)?.id;
        if (!basicoId || !premiumId) {
            // An environment that never seeded this vertical has nothing to move.
            continue;
        }

        const moved = await ctx.db
            .update(billingSubscriptions)
            .set({ planId: basicoId, updatedAt: new Date() })
            .where(
                and(
                    eq(billingSubscriptions.planId, premiumId),
                    inArray(billingSubscriptions.status, [...LIVE_SUBSCRIPTION_STATUSES]),
                    // A status filter is NOT a soft-delete filter: deleting a row
                    // never changes its status, so both predicates are required.
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .returning({ id: billingSubscriptions.id });

        subscriptionsRepointed += moved.length;
    }

    const counts = {
        plansPromoted: promoted.length,
        pricesCreated,
        plansRetired: retired.length,
        subscriptionsRepointed
    };

    const changed =
        counts.plansPromoted +
            counts.pricesCreated +
            counts.plansRetired +
            counts.subscriptionsRepointed >
        0;

    return {
        summary: changed
            ? `HOS-818: promoted ${counts.plansPromoted} basico plan(s) (${counts.pricesCreated} price row(s) created), retired ${counts.plansRetired} premium plan(s), repointed ${counts.subscriptionsRepointed} live subscription(s). MANUAL STEP STILL PENDING: repoint the API's commerce plan-slug env var in Coolify at gastronomy:gastronomy-basico,experience:experience-basico — until then checkout keeps resolving the retired premium plans.`
            : 'HOS-818: commerce tiers already retiered or operator-edited — no change.',
        counts
    };
}
