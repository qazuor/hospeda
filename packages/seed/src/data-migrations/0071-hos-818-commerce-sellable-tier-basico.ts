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
 * 3. **Retires the `*-premium` row — but ONLY if its `*-basico` counterpart
 *    verifiably took over** (active AND carrying an active monthly ARS price).
 *    `active = false` and nothing else: price rows, metadata and MercadoPago
 *    `preapproval_plan`s are left completely alone, because live subscriptions
 *    hang off those plans (HOS-818: "do NOT delete or deactivate the
 *    preapproval_plan in the MercadoPago panel").
 * 4. **Repoints LIVE subscriptions** from the premium plan to its basic
 *    counterpart. Scoped to non-terminal statuses on purpose: a cancelled or
 *    expired row is a historical record of what that customer actually bought,
 *    and rewriting it would falsify the archive to no one's benefit.
 *
 * Every step runs per vertical, so gastronomy and experience are decided
 * independently — one can complete while the other is left alone.
 *
 * ## The sellability gate (step 3), and why it is not optional
 *
 * Steps 1 and 2 can BOTH decline to act on the same row, and the combination is
 * not hypothetical. A `*-basico` sitting at `active = false` with a NON-ZERO
 * `monthly_price_ars` — an operator who priced it from the admin editor without
 * enabling it — is skipped by step 1's OR-PRESERVE guard (which requires the
 * price to still be 0) and is invisible to step 2 (which only serves active
 * plans). Retiring the premium anyway would leave that vertical with no sellable
 * plan at all.
 *
 * That failure is silent, which is what makes it serious: the commerce checkout
 * has no `PLAN_DISABLED` guard (unlike `routes/billing/start-paid.ts` and
 * `plan-change.ts`), and `resolvePlanBySlug` does not filter on `active`. So
 * nothing rejects the retired plan up front — the vertical simply throws
 * `NO_MONTHLY_PRICE` on a real buyer's first attempt.
 *
 * The gate inverts the risk: the premium stays active until its replacement is
 * provably ready. Leaving the OLD tier selling is a no-op for the customer
 * (identical price, limits and entitlements); retiring it early is an outage.
 * When the gate fires, the `summary` names the vertical and the reason — the
 * environment is then half-migrated, and only an operator can decide the fix.
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
    let plansPromoted = 0;
    let pricesCreated = 0;
    let plansRetired = 0;
    let subscriptionsRepointed = 0;

    /** Verticals where the premium tier was deliberately LEFT ACTIVE, and why. */
    const blocked: string[] = [];

    // One pass per vertical. The whole sequence is per-pair rather than four
    // catalogue-wide statements for two reasons: the gastronomy premium must
    // only ever land on the gastronomy basic plan, and — more importantly — step
    // 3 has to be able to spare ONE vertical's premium without sparing both.
    for (const pair of TIER_PAIRS) {
        // ── 1. Promote the `*-basico` row to the sellable configuration ──────
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
                    eq(billingPlans.name, pair.basico),
                    // OR-PRESERVE: only a row still at the pre-HOS-818 baseline
                    // (inactive AND unpriced). An operator who already priced or
                    // enabled it made a decision this migration must not overwrite.
                    eq(billingPlans.active, false),
                    sql`COALESCE(${billingPlans.monthlyPriceArs}, 0) = 0`
                )
            )
            .returning({ name: billingPlans.name });

        plansPromoted += promoted.length;

        // Re-read rather than trusting step 1's result: the row may have been
        // promoted just now, promoted by an earlier run, or skipped by
        // OR-PRESERVE. Only the row's CURRENT state decides what follows.
        const basicoRows = await ctx.db
            .select({
                id: billingPlans.id,
                active: billingPlans.active,
                livemode: billingPlans.livemode
            })
            .from(billingPlans)
            .where(eq(billingPlans.name, pair.basico))
            .limit(1);

        const basico = basicoRows[0];
        if (!basico) {
            blocked.push(
                `${pair.premium}: left ACTIVE — no ${pair.basico} row in this environment`
            );
            continue;
        }

        // ── 2. Give the now-sellable plan its monthly ARS price row ──────────
        const existingPrices = await ctx.db
            .select({ id: billingPrices.id, active: billingPrices.active })
            .from(billingPrices)
            .where(
                and(
                    eq(billingPrices.planId, basico.id),
                    eq(billingPrices.currency, 'ARS'),
                    eq(billingPrices.billingInterval, 'month'),
                    eq(billingPrices.intervalCount, 1)
                )
            )
            .limit(1);

        const existingPrice = existingPrices[0];
        let hasActiveMonthlyPrice = existingPrice?.active === true;

        if (basico.active && !existingPrice) {
            await ctx.db.insert(billingPrices).values({
                planId: basico.id,
                currency: 'ARS',
                unitAmount: NEW_MONTHLY_PRICE_ARS,
                billingInterval: 'month',
                intervalCount: 1,
                active: true,
                // Mirrors the plan row's own livemode, exactly as
                // `ensureCommercePlan` does — a price in the other mode is
                // invisible to checkout.
                livemode: basico.livemode
            });
            pricesCreated += 1;
            hasActiveMonthlyPrice = true;
        }

        // An EXISTING but inactive price is left alone rather than reactivated:
        // deactivating a price is an operator action, and overriding it here
        // would be the same class of mistake OR-PRESERVE exists to avoid. The
        // gate below then refuses to retire this vertical's premium, which is
        // the safe half of that trade.

        // ── 3. Sellability gate — the premium is retired ONLY if the basic
        //       tier verifiably took over (HOS-818 review finding) ────────────
        //
        // Steps 1 and 2 can BOTH decline to act on the same row, and the
        // combination is not hypothetical: a `*-basico` sitting at
        // `active = false` with a non-zero `monthly_price_ars` (an operator who
        // priced it from the admin editor without enabling it) is skipped by
        // step 1's OR-PRESERVE guard AND invisible to step 2's `active` check.
        // Retiring the premium anyway would leave that vertical with NO sellable
        // plan at all, and — because the commerce checkout has no
        // `PLAN_DISABLED` guard — the failure would surface only as
        // `NO_MONTHLY_PRICE` on a real buyer's first attempt.
        //
        // So the premium stays active until its replacement is provably ready.
        // Leaving the OLD tier selling is a no-op for the customer; retiring it
        // early is an outage.
        if (!basico.active || !hasActiveMonthlyPrice) {
            const reason = basico.active
                ? `${pair.basico} has no ACTIVE monthly ARS price`
                : `${pair.basico} is INACTIVE (operator-edited, so OR-PRESERVE skipped the promotion)`;
            blocked.push(`${pair.premium}: left ACTIVE — ${reason}`);
            continue;
        }

        // ── 4. Retire the `*-premium` row (flag only — see the header) ───────
        const retired = await ctx.db
            .update(billingPlans)
            .set({ active: false, updatedAt: new Date() })
            .where(and(eq(billingPlans.name, pair.premium), eq(billingPlans.active, true)))
            .returning({ name: billingPlans.name });

        plansRetired += retired.length;

        // ── 5. Repoint this vertical's LIVE subscriptions premium → basico ───
        // Reached only past the gate, so a subscription is never moved onto a
        // plan that cannot bill it.
        const premiumRows = await ctx.db
            .select({ id: billingPlans.id })
            .from(billingPlans)
            .where(eq(billingPlans.name, pair.premium))
            .limit(1);

        const premiumId = premiumRows[0]?.id;
        if (!premiumId) {
            // An environment that never seeded this vertical's premium tier has
            // nothing to move.
            continue;
        }

        const moved = await ctx.db
            .update(billingSubscriptions)
            .set({ planId: basico.id, updatedAt: new Date() })
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
        plansPromoted,
        pricesCreated,
        plansRetired,
        subscriptionsRepointed,
        verticalsBlocked: blocked.length
    };

    const changed = plansPromoted + pricesCreated + plansRetired + subscriptionsRepointed > 0;

    const applied = changed
        ? `HOS-818: promoted ${plansPromoted} basico plan(s) (${pricesCreated} price row(s) created), retired ${plansRetired} premium plan(s), repointed ${subscriptionsRepointed} live subscription(s).`
        : 'HOS-818: commerce tiers already retiered or operator-edited — no change.';

    // Surfaced in the summary, not just swallowed into a count: an operator who
    // runs this has to learn that a vertical was left untouched AND why, because
    // the environment is now half-migrated and only they can decide the fix.
    const warning =
        blocked.length > 0
            ? ` ATTENTION — ${blocked.length} vertical(s) left on the PREMIUM tier because the basic tier is not sellable: ${blocked.join('; ')}. Those verticals keep selling premium (no outage), but the rename did NOT take effect for them: activate/price the basic plan and re-run.`
            : '';

    const manual = ` MANUAL STEP STILL PENDING: repoint the API's commerce plan-slug env var in Coolify at gastronomy:gastronomy-basico,experience:experience-basico — until then checkout keeps resolving the premium plans.`;

    return {
        summary: `${applied}${warning}${manual}`,
        counts
    };
}
