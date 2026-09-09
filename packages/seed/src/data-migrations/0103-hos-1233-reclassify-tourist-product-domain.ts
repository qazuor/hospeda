/**
 * @fileoverview
 * Data migration: 0103-hos-1233-reclassify-tourist-product-domain
 *
 * HOS-1233 T-038 / AC-14. The contract half of the expand/contract that
 * T-033 and T-034 opened: every write now names its product domain, so the
 * rows that were written before any write did are corrected here.
 *
 * ## What is wrong in the live databases
 *
 * Measured 2026-09-08, both environments:
 *
 * | env | plan | `billing_plans.product_domain` | `billing_subscriptions.product_domain` | n |
 * | -- | -- | -- | -- | -- |
 * | staging | `tourist-vip` | `accommodation` | `accommodation` | 2 |
 * | prod | `tourist-vip` | `accommodation` | `accommodation` | 1 |
 *
 * The commerce verticals are classified correctly in the same query. Tourist
 * is the only misfiled one, and it is misfiled at the PLAN row, not merely
 * inherited by a subscription.
 *
 * Nothing was ever wrong in the code. `ProductDomainEnum` had no `tourist`
 * member, so nothing could assign one, and `billing_plans.product_domain` is
 * `NOT NULL` **with a default** — which means the omission never presented as
 * an omission. Every tourist plan ever seeded was born claiming
 * `accommodation`, silently, and the entitlement engine has counted a paying
 * tourist as an accommodation subscriber ever since.
 *
 * ## What this migration does, and does not
 *
 * Two `UPDATE`s, in this order:
 *
 * 1. `billing_plans` — the tourist plan rows, matched by the slug each
 *    tourist {@link PlanDefinition} carries.
 * 2. `billing_subscriptions` — every subscription pointing at one of those
 *    plans, matched by the plan UUIDs resolved in step 1.
 *
 * **Derived from the plan definitions, never from a slug list written here.**
 * The two constants are imported and their `slug` / `productDomain` are read
 * off them, so this migration cannot disagree with the config it exists to
 * enforce. It is deliberately scoped to the tourist plans and nothing else:
 * a general "sync every plan's domain from config" pass belongs to the seed's
 * Model C capability sync (T-034), which runs on every deploy — a
 * one-shot migration is the wrong instrument for a recurring job.
 *
 * **Never filtered by status or `deleted_at`.** A cancelled or soft-deleted
 * tourist subscription still has to be filed correctly: `hasAnyPriorSubscription`
 * (`trial-eligibility.service.ts`) reads PRIOR subscriptions, and a historical
 * tourist row read as a prior *accommodation* subscription is what makes a
 * tourist-turned-host's real trial come back `consumed`. Leaving the dead rows
 * behind would leave that read wrong (§4b).
 *
 * **Never writes `NULL`, and never writes anything but `'tourist'`.**
 * `subscriptionMatchesDomain` treats `null` as accommodation for legacy rows,
 * so a nulled column here would be the one value that leaves the bug in place
 * while looking like it was fixed.
 *
 * **Idempotent.** Both statements exclude rows already carrying the target
 * value, so a second run matches nothing and reports no change. That is worth
 * stating explicitly because a migration that reclassifies unconditionally is
 * *also* idempotent, and would pass an idempotency test while quietly
 * rewriting rows it had no business touching.
 *
 * ## Ordering (spec R-8)
 *
 * This runs while `@qazuor/qzpay-drizzle` still declares
 * `.default('accommodation')` on both columns, and that is deliberate. The
 * default is removed only AFTER every write names its domain and these rows
 * are corrected — dropping it earlier turns every subscription insert into a
 * `NOT NULL` violation, for every product line at once, at the first checkout.
 * Nothing in this file depends on the default; it simply must not have been
 * removed yet elsewhere.
 */

import { TOURIST_FREE_PLAN, TOURIST_VIP_PLAN } from '@repo/billing';
import { and, billingPlans, billingSubscriptions, inArray, ne } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0103-hos-1233-reclassify-tourist-product-domain',
    group: 'required',
    // Irreversibly overwrites a column on live billing rows, and changes which
    // entitlement engine counts them. Small (1 subscription in prod, 2 in
    // staging) but real money is attached, so a production run takes the
    // explicit `--allow-destructive` opt-in. Declaring it `false` because the
    // change is a *correction* would be exactly the quiet fail-open the gate
    // exists to prevent — 0102 records the same reasoning.
    destructive: true,
    // HOS-433: a migration whose target column has been dropped moves zero
    // rows, reports success, and is ledgered applied forever. These two are
    // the columns whose absence would make this migration silently
    // meaningless, so the runner aborts loudly instead.
    requiresColumns: [
        { table: 'billing_plans', column: 'product_domain' },
        { table: 'billing_subscriptions', column: 'product_domain' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * The tourist plans, read off their definitions rather than restated.
 *
 * `billing_plans.name` stores the slug (the QZPay backend resolves plans by
 * it), which is why the match is on `name` and not on a `slug` column.
 */
const TOURIST_PLANS = [TOURIST_FREE_PLAN, TOURIST_VIP_PLAN] as const;

/**
 * The domain every row this migration touches must end up carrying.
 *
 * Taken from the plan definitions themselves — if a future edit moved the
 * tourist plans to some other domain, this migration would follow rather than
 * write a value the config disagrees with. Both definitions must agree, and
 * a disagreement aborts rather than picking one.
 */
function resolveTargetDomain(): string {
    const domains = [...new Set(TOURIST_PLANS.map((plan) => plan.productDomain))];
    const only = domains[0];
    if (domains.length !== 1 || only === undefined) {
        throw new Error(
            `The tourist plans disagree on their product domain (${domains.join(', ')}). ` +
                'This migration reclassifies them as one group and refuses to guess which is right.'
        );
    }
    return only;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const db = ctx.db;
    const now = new Date();
    const targetDomain = resolveTargetDomain();
    const slugs = TOURIST_PLANS.map((plan) => plan.slug);

    // ── 1. The plan rows ─────────────────────────────────────────────────────
    //
    // `ne(...)` is what makes the second run a no-op. Without it the statement
    // would still be idempotent in outcome while rewriting rows that were
    // already correct, and the counts would never fall to zero.
    const plansReclassified = await db
        .update(billingPlans)
        .set({ productDomain: targetDomain, updatedAt: now })
        .where(and(inArray(billingPlans.name, slugs), ne(billingPlans.productDomain, targetDomain)))
        .returning({ id: billingPlans.id, name: billingPlans.name });

    // ── 2. Their subscriptions ───────────────────────────────────────────────
    //
    // Resolved WITHOUT a `deleted_at IS NULL` filter, and independently of the
    // update above: the plan ids are needed whether or not step 1 changed
    // anything, because a re-run must still be able to find already-corrected
    // plans in order to report zero remaining subscriptions.
    const planRows = await db
        .select({ id: billingPlans.id, name: billingPlans.name })
        .from(billingPlans)
        .where(inArray(billingPlans.name, slugs));
    const planIds = planRows.map((row) => row.id);

    let subscriptionsReclassified = 0;
    if (planIds.length > 0) {
        // `billing_subscriptions.plan_id` is a varchar holding the plan UUID
        // (a known schema quirk, documented in the root CLAUDE.md), so this is
        // a string comparison against the ids resolved above and NOT a join.
        const rows = await db
            .update(billingSubscriptions)
            .set({ productDomain: targetDomain, updatedAt: now })
            .where(
                and(
                    inArray(billingSubscriptions.planId, planIds),
                    ne(billingSubscriptions.productDomain, targetDomain)
                )
            )
            .returning({ id: billingSubscriptions.id });
        subscriptionsReclassified = rows.length;
    }

    const planCount = plansReclassified.length;
    const changed = planCount + subscriptionsReclassified;

    // A tourist plan that is not in the database at all is not an error — a
    // fresh environment seeds them already correct — but it IS worth saying,
    // because "0 rows changed" otherwise reads identically to "the migration
    // ran against the wrong database".
    const foundSlugs = new Set(planRows.map((row) => row.name));
    const missing = slugs.filter((slug) => !foundSlugs.has(slug));
    const missingNote =
        missing.length > 0
            ? ` NOTE: ${missing.join(', ')} not present in this database (a fresh environment seeds them already correct).`
            : '';

    return {
        summary:
            changed === 0
                ? `Every tourist plan and subscription already reports '${targetDomain}' — no change.${missingNote}`
                : `Reclassified ${planCount} tourist plan row(s) and ${subscriptionsReclassified} ` +
                  `subscription(s) from their inherited domain to '${targetDomain}'.${missingNote}`,
        counts: {
            plansReclassified: planCount,
            subscriptionsReclassified,
            touristPlansFound: planIds.length,
            touristPlansExpected: slugs.length,
            touristPlansMissing: missing.length
        }
    };
}
