/**
 * @fileoverview
 * Data migration: 0102-hos-1224-retire-tourist-plus-and-null-price-trial-days
 *
 * Two deltas that share one cause — a value living in the database that the
 * baseline no longer produces, and that nothing wants.
 *
 * ## Part 1 — `tourist-plus` is retired for good
 *
 * HOS-301 D1 cancelled the plan as a product. `0052-hos-301-deactivate-tourist-plus`
 * set `active = false` and `0066-hos-692-domain-rewrite-and-plan-cleanup`
 * soft-deleted it. Both are ledgered applied on staging and production.
 *
 * Staging's row was `deleted_at = NULL` anyway on 2026-09-07, with an `active`
 * subscription on it. That is not a migration that failed — it is a migration
 * that was UNDONE. `--reset` TRUNCATEs every table but deliberately preserves
 * `seed_migrations` (see `packages/seed/src/utils/dbReset.ts`, where the ledger
 * is a documented permanent exclusion), so a re-seed of staging rebuilt
 * `billing_plans` from `ALL_PLANS` — which still contained `TOURIST_PLUS_PLAN`
 * — while the ledger kept `0052` and `0066` marked applied so neither could
 * ever run again. Measured: every staging plan row carries
 * `created_at = 2026-08-24 02:58:46`, minutes AFTER `0066` was ledgered at
 * `02:43:09` that same morning, and every other core table (users, amenities,
 * destinations) was created in the same 02:57-03:00 window.
 *
 * **The durable fix is in the baseline, not here**: HOS-1224 removed
 * `TOURIST_PLUS_PLAN` from `packages/billing/src/config/plans.config.ts`
 * entirely, so no future re-seed can recreate the row, and
 * `packages/billing/test/plans.test.ts` pins the retired slug by name. This
 * migration carries the same delta to the databases already seeded — the
 * HOS-25 dual-write rule.
 *
 * ## Part 2 — `billing_prices.trial_days` goes to NULL everywhere
 *
 * Nothing in Hospeda reads this column to decide the product. The real trial is
 * `billing_plans.metadata.trialDays` on the dedicated `owner-trial` /
 * `gastronomy-trial` / `experience-trial` plans, which carry no price row at
 * all. `0055` calls its own write a "mirror" and states "Nothing currently
 * reads it"; `0064` says the column "is deliberately NOT touched here".
 *
 * That was never the same as harmless. `@qazuor/qzpay-core` INHERITS the
 * resolved price's `trialDays` whenever a caller of `subscriptions.create`
 * omits the field, and `@qazuor/qzpay-drizzle` turns the inherited number into
 * `trial_start` / `trial_end` on the new `billing_subscriptions` row. Measured
 * 2026-09-07: `owner-basico`, `owner-pro` and `owner-premium` carry
 * `trial_days = 30` on their monthly price in BOTH staging and production. That
 * is HOS-1221's bug D3 — a PAID subscription born marked `trialing` for 30 days
 * with the customer already charged.
 *
 * HOS-1221 states `trialDays: 0` explicitly at the call sites on the paid path.
 * This is the other half: a column with no value cannot be inherited by a call
 * site that forgets. The baseline half is `ensurePrice` in
 * `billingPlans.seed.ts` and `createPlan` in `plan.crud.ts`, neither of which
 * writes the column any more; `scripts/check-no-price-trial-days.ts` (G-2)
 * fails CI if either does again.
 *
 * ## Idempotency, and the 0051 trap it avoids
 *
 * `0051-hos-301-tourist-trial-30-days` guarded its price update on finding the
 * exact previous value (`trial_days = 14`). Production had never been written
 * that value — the earlier `0017` only touched `metadata` — so `0051` matched
 * nothing, changed nothing, and is ledgered applied forever. That is why
 * `tourist-vip` reads `30` on staging and `NULL` on production today.
 *
 * Every statement below is scoped by the state it is trying to REACH, never by
 * a specific old value:
 *
 * - the plan is deactivated `WHERE active = true` and soft-deleted
 *   `WHERE deleted_at IS NULL`, as two independent statements so each converges
 *   whatever the other found;
 * - prices are deactivated `WHERE active = true`;
 * - `trial_days` is nulled `WHERE trial_days IS NOT NULL`, so it converges from
 *   14, from 30, or from any value an operator ever typed into the admin panel.
 *
 * A second run therefore matches nothing and reports zero, and a fresh database
 * — where `tourist-plus` never existed and no price carries a trial — is a
 * clean no-op rather than an error.
 *
 * ## What it deliberately does NOT do
 *
 * - **It never touches a provider-backed subscription.** Only rows with
 *   `mp_subscription_id IS NULL` are retired; anything with a MercadoPago
 *   preapproval behind it is counted, reported in the summary, and left exactly
 *   as it is. Production carries ZERO subscriptions on this plan in any status,
 *   soft-deleted rows included (measured 2026-09-07), and staging's single one
 *   is the `tourist-plus@local.test` SPEC-143 fixture with a NULL provider id —
 *   but the rule is written for the row that shows up later, not for the rows
 *   counted today. A cancellation belongs to the billing lifecycle, never to a
 *   seed migration.
 * - **It does not delete the `tourist-plus@local.test` user.** The subscription
 *   is what made the plan resolve; an account with no subscription is an
 *   ordinary free-tier user, and deleting people's rows is not this migration's
 *   business. That staging carries 22 `@local.test` accounts at all is reported
 *   separately — production carries none.
 * - **It does not touch `billing_plans.metadata.trialDays`.** That is the field
 *   the product actually reads, and it stays exactly as it is.
 */
import {
    and,
    billingPlans,
    billingPrices,
    billingSubscriptions,
    eq,
    inArray,
    isNotNull,
    isNull
} from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0102-hos-1224-retire-tourist-plus-and-null-price-trial-days',
    group: 'required',
    // Soft-deletes subscription rows and irreversibly overwrites a column across
    // the whole price table. `0066`, which also soft-deleted plan rows, is
    // declared the same way. Declaring it `false` to dodge the production
    // opt-in would be exactly the quiet fail-open the gate exists to prevent —
    // so a production run needs `--allow-destructive`, deliberately.
    destructive: true,
    // HOS-433: a migration whose source column has been dropped moves zero rows,
    // reports success, and is ledgered applied forever. These are the columns
    // whose absence would make this migration silently meaningless, so the
    // runner aborts loudly instead.
    requiresColumns: [
        { table: 'billing_prices', column: 'trial_days' },
        { table: 'billing_subscriptions', column: 'mp_subscription_id' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * The retired plan. A literal on purpose: it is a historical fact about rows
 * already in the database, and importing it from `@repo/billing` is impossible
 * anyway now that the definition is gone from the config.
 */
const RETIRED_PLAN_SLUG = 'tourist-plus';

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const now = new Date();
    const db = ctx.db;

    // ── The plan row: deactivated and soft-deleted, independently ────────────
    const deactivated = await db
        .update(billingPlans)
        .set({ active: false, updatedAt: now })
        .where(and(eq(billingPlans.name, RETIRED_PLAN_SLUG), eq(billingPlans.active, true)))
        .returning({ id: billingPlans.id });

    const softDeleted = await db
        .update(billingPlans)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(billingPlans.name, RETIRED_PLAN_SLUG), isNull(billingPlans.deletedAt)))
        .returning({ id: billingPlans.id });

    // Resolved WITHOUT a `deleted_at IS NULL` filter on purpose: the row this
    // migration has to reach through is precisely the soft-deleted one.
    const planRows = await db
        .select({ id: billingPlans.id })
        .from(billingPlans)
        .where(eq(billingPlans.name, RETIRED_PLAN_SLUG));
    const planIds = planRows.map((row) => row.id);

    // ── Its price rows ───────────────────────────────────────────────────────
    let pricesDeactivated = 0;
    if (planIds.length > 0) {
        const rows = await db
            .update(billingPrices)
            .set({ active: false, updatedAt: now })
            .where(and(inArray(billingPrices.planId, planIds), eq(billingPrices.active, true)))
            .returning({ id: billingPrices.id });
        pricesDeactivated = rows.length;
    }

    // ── Its subscriptions, provider-backed ones untouched ────────────────────
    let subscriptionsRetired = 0;
    let providerBackedLeftAlone = 0;
    if (planIds.length > 0) {
        const live = await db
            .select({
                id: billingSubscriptions.id,
                mpSubscriptionId: billingSubscriptions.mpSubscriptionId
            })
            .from(billingSubscriptions)
            .where(
                and(
                    inArray(billingSubscriptions.planId, planIds),
                    isNull(billingSubscriptions.deletedAt)
                )
            );

        const fixtureIds = live.filter((row) => row.mpSubscriptionId === null).map((row) => row.id);
        providerBackedLeftAlone = live.length - fixtureIds.length;

        if (fixtureIds.length > 0) {
            const rows = await db
                .update(billingSubscriptions)
                .set({ deletedAt: now, updatedAt: now })
                .where(inArray(billingSubscriptions.id, fixtureIds))
                .returning({ id: billingSubscriptions.id });
            subscriptionsRetired = rows.length;
        }
    }

    // ── The column, everywhere ───────────────────────────────────────────────
    const nulled = await db
        .update(billingPrices)
        .set({ trialDays: null, updatedAt: now })
        .where(isNotNull(billingPrices.trialDays))
        .returning({ id: billingPrices.id });

    const plansDeactivated = deactivated.length;
    const plansSoftDeleted = softDeleted.length;
    const trialDaysCleared = nulled.length;

    const changed =
        plansDeactivated +
        plansSoftDeleted +
        pricesDeactivated +
        subscriptionsRetired +
        trialDaysCleared;

    const warning =
        providerBackedLeftAlone > 0
            ? ` WARNING: ${providerBackedLeftAlone} subscription(s) on ${RETIRED_PLAN_SLUG} carry a MercadoPago preapproval and were LEFT UNTOUCHED — cancel those through the billing lifecycle, not here.`
            : '';

    return {
        summary:
            changed === 0
                ? `${RETIRED_PLAN_SLUG} is already retired and no price carries a trial_days — no change.${warning}`
                : `Retired ${RETIRED_PLAN_SLUG}: ${plansDeactivated} plan deactivated, ${plansSoftDeleted} soft-deleted, ` +
                  `${pricesDeactivated} price row(s) deactivated, ${subscriptionsRetired} fixture subscription(s) retired. ` +
                  `Cleared billing_prices.trial_days on ${trialDaysCleared} row(s).${warning}`,
        counts: {
            plansDeactivated,
            plansSoftDeleted,
            pricesDeactivated,
            subscriptionsRetired,
            providerBackedLeftAlone,
            trialDaysCleared
        }
    };
}
