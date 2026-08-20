/**
 * @fileoverview
 * Data migration: 0066-hos-692-domain-rewrite-and-plan-cleanup
 *
 * HOS-692 (epic HOS-589), release B. Two independent cleanups, bundled into
 * one file because only three data-migration numbers were reserved for this
 * issue (0065/0066/0067) and both are release-B, non-incident, no-environment-
 * gating work — unlike 0065 (orphan purge, production-only, blocked on
 * HOS-712) and 0067 (the undo, dormant by design). Each part is independent:
 * either can be read/reviewed on its own, and a failure in one rolls back
 * the whole migration atomically (both run inside the runner's single
 * transaction), so there is no partial-apply state to reason about.
 *
 * ## Part 1 — the commerce/gastronomy/experience domain rewrite (§6.13)
 *
 * `billing_subscriptions.product_domain` and
 * `commerce_listing_subscriptions.product_domain` both still say `'commerce'`
 * for rows created before HOS-685 widened the vocabulary. This part rewrites
 * both columns to the row's real vertical, read from the LINK row's
 * `entity_type` — the only place the vertical is recorded.
 *
 * Order-independent of `0059-purge-test-and-commerce-example` and
 * `0065-hos-692-purge-orphaned-commerce-fixtures` (whichever number that ends
 * up being, per HOS-712): this part only ever touches rows that exist NOW.
 * Rows 0059/0065 delete are simply gone by the time this runs (numeric order
 * places 0065 before 0066 in any single batch) or were never `'commerce'` to
 * begin with because 0065 already deleted them. Nothing here depends on
 * `billing_customers` or `users`.
 *
 * **Both columns rewritten together, per subscription**: for each
 * `billing_subscriptions` row still at `'commerce'`, this resolves the
 * vertical from its `commerce_listing_subscriptions` rows' `entity_type`, then
 * issues the SAME pair of statements — one `UPDATE` on `billing_subscriptions`,
 * one on `commerce_listing_subscriptions` — so the two columns can never end
 * up disagreeing (§6.13: "a migration that rewrites one column and not the
 * other leaves the two disagreeing, which nothing in the code would notice").
 *
 * **Never guesses.** A subscription is left at `'commerce'` (and counted,
 * never silently dropped) when:
 * - it has NO link row at all (nothing to derive the vertical from — and a
 *   subscription with no link row grants nothing to anybody in any domain,
 *   so leaving it is inert, not lossy);
 * - its link rows disagree on `entity_type` (should not happen under the
 *   per-owner-per-vertical model of §6.8, but this migration does not assume
 *   its own precondition — it verifies row-by-row);
 * - a link row's `entity_type` is not one of the two known verticals
 *   (`'gastronomy'` | `'experience'`) — a data-integrity anomaly this
 *   migration refuses to launder into a guess.
 *
 * **Never writes `NULL`.** Every write is either the exact string
 * `'gastronomy'` or `'experience'`, or no write at all (the row stays
 * `'commerce'`). `isAccommodationSubscription` treats `null`/`undefined` as
 * accommodation (`subscription-product-domain.ts:77-95`), so a nulled column
 * would be the one value that leaks a commerce subscription into a host's
 * entitlement set — exactly what SPEC-239 exists to prevent.
 *
 * ## Part 2 — plan catalogue cleanup (spec §6.9)
 *
 * | Plan | Live subscriptions | Action |
 * | --- | --- | --- |
 * | `complex-basico` / `-pro` / `-premium` | 0 | hard delete (defensively re-verified below, not just trusted from the issue's inventory) |
 * | `tourist-plus` | 2, both `cancelled` | already deactivated by `0052-hos-301-deactivate-tourist-plus` — this migration ALSO soft-deletes it |
 * | `owner-test-daily` | 1, `cancelled` | deactivate (not yet done anywhere) + soft-delete |
 *
 * `tourist-plus` / `owner-test-daily` are soft-deleted, not hard-deleted:
 * historical subscriptions point at them, and a hard delete would leave that
 * history referencing a plan that no longer exists. `billing_plans.deletedAt`
 * is the standard soft-delete column this codebase's read paths already
 * filter on.
 *
 * The 3 `complex-*` plans ARE hard-deleted (0 live subscriptions). Before
 * deleting each one, this migration re-checks `billing_subscriptions` for any
 * row whose `plan_id` matches — `billing_subscriptions.plan_id` is a varchar
 * with NO enforced FK to `billing_plans.id` (`packages/db/CLAUDE.md`), so a
 * wrong assumption here would not error, it would silently orphan a real
 * subscription's plan lookup. A plan with an unexpected live subscription is
 * skipped and reported, never force-deleted. `billing_prices` rows for a
 * deleted plan cascade automatically (`billing_prices.planId` REFERENCES
 * `billing_plans.id` ON DELETE CASCADE).
 *
 * **`metadata.monthlyPriceArs` is stripped from every `billing_plans` row**,
 * not just the plans named above — the DTO never reads it
 * (`plan.crud.ts:53`: `monthlyPriceArs ← monthly billing_prices.unitAmount`),
 * and a dead mirror accumulates contradictions (the stale `$5.000` on
 * `commerce-listing` against the real `$15.000`). The three write sites that
 * would otherwise put it straight back on the next admin edit
 * (`PlanService.createPlan`, `PlanService.updatePlan`, the seed baseline) are
 * fixed in the same PR — see `plan.crud.ts` and `billingPlans.seed.ts`.
 * `model-c-field-split.ts` is untouched: its `monthlyPriceArs: 'commercial'`
 * entry classifies the TYPED column (the live price of every plan), not this
 * mirror — there is no mirror entry there to remove.
 *
 * `max_properties` is explicitly OUT of scope (HOS-684, a ~15-file refactor
 * unrelated to commerce) — this migration never reads or writes it.
 *
 * ## `destructive` flag
 *
 * `true`: Part 1 can leave rows unrewritten (never data loss, but a real
 * mutation) and Part 2 HARD-DELETES the 3 complex plan rows. The runner's
 * production safety gate requires an explicit opt-in
 * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` / `--allow-destructive`) before
 * this runs in production.
 *
 * ## Idempotency
 *
 * Every `UPDATE` is guarded so a re-run only touches rows still in the
 * "before" state (`product_domain = 'commerce'`, `deletedAt IS NULL`, or
 * `metadata ? 'monthlyPriceArs'`), and the complex-plan `DELETE` matches by a
 * literal slug list that is empty to match on a second run. A steady-state
 * re-run reports zero for every counter.
 *
 * @module data-migrations/0066-hos-692-domain-rewrite-and-plan-cleanup
 */
import {
    and,
    billingPlans,
    billingSubscriptions,
    commerceListingSubscriptions,
    eq,
    isNull,
    sql
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0066-hos-692-domain-rewrite-and-plan-cleanup',
    group: 'required',
    destructive: true
} as const satisfies SeedMigrationModule['meta'];

/** The two recognized commerce verticals — anything else is an anomaly, never guessed. */
const KNOWN_VERTICALS: ReadonlySet<string> = new Set([
    ProductDomainEnum.GASTRONOMY,
    ProductDomainEnum.EXPERIENCE
]);

/** Plans with zero live subscriptions, removed outright (spec §6.9). */
const COMPLEX_PLAN_SLUGS: readonly string[] = [
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

/** Plans deactivated + soft-deleted, never hard-deleted — historical subscriptions point at them. */
const SOFT_DELETED_PLAN_SLUGS: readonly string[] = ['tourist-plus', 'owner-test-daily'] as const;

/**
 * Resolves each subscription's vertical from its link rows' `entity_type`,
 * never guessing when the link rows are absent, mixed, or unrecognized.
 *
 * @returns A map of `subscriptionId` → resolved vertical, present ONLY for
 *   subscriptions whose link rows unambiguously agree on a known vertical.
 */
async function resolveSubscriptionVerticals(
    db: SeedMigrationCtx['db']
): Promise<ReadonlyMap<string, 'gastronomy' | 'experience'>> {
    const linkRows = await db
        .select({
            subscriptionId: commerceListingSubscriptions.subscriptionId,
            entityType: commerceListingSubscriptions.entityType
        })
        .from(commerceListingSubscriptions);

    // subscriptionId -> resolved vertical, or `null` once a disagreement or an
    // unrecognized entityType is observed (poisoned — never resolved after).
    const bySubscription = new Map<string, 'gastronomy' | 'experience' | null>();

    for (const row of linkRows) {
        const isKnown = KNOWN_VERTICALS.has(row.entityType);
        const existing = bySubscription.get(row.subscriptionId);

        if (existing === null) {
            continue; // already poisoned, stays poisoned
        }
        if (!isKnown) {
            bySubscription.set(row.subscriptionId, null);
            continue;
        }
        const vertical = row.entityType as 'gastronomy' | 'experience';
        if (existing === undefined) {
            bySubscription.set(row.subscriptionId, vertical);
        } else if (existing !== vertical) {
            bySubscription.set(row.subscriptionId, null); // disagreement — poison it
        }
    }

    const resolved = new Map<string, 'gastronomy' | 'experience'>();
    for (const [subscriptionId, vertical] of bySubscription) {
        if (vertical !== null) {
            resolved.set(subscriptionId, vertical);
        }
    }
    return resolved;
}

/**
 * Part 1: rewrites `product_domain` on both tables for every commerce
 * subscription whose vertical can be unambiguously resolved.
 */
async function rewriteCommerceDomain(
    ctx: SeedMigrationCtx
): Promise<SeedMigrationResult['counts']> {
    const { db } = ctx;

    const verticalBySubscription = await resolveSubscriptionVerticals(db);

    const commerceSubs = await db
        .select({ id: billingSubscriptions.id })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.productDomain, ProductDomainEnum.COMMERCE));

    let subscriptionsRewritten = 0;
    let linkRowsRewritten = 0;
    let subscriptionsWithoutLinkRow = 0;
    let subscriptionsWithAmbiguousLinkRows = 0;

    for (const sub of commerceSubs) {
        const vertical = verticalBySubscription.get(sub.id);

        if (vertical === undefined) {
            // No link row, OR link rows disagree/carry an unrecognized
            // entityType. Distinguish only for reporting — both leave the
            // subscription at 'commerce' untouched, never guessed.
            const [anyLink] = await db
                .select({ subscriptionId: commerceListingSubscriptions.subscriptionId })
                .from(commerceListingSubscriptions)
                .where(eq(commerceListingSubscriptions.subscriptionId, sub.id))
                .limit(1);
            if (anyLink) {
                subscriptionsWithAmbiguousLinkRows += 1;
                logger.warn(
                    `HOS-692 domain rewrite: subscription ${sub.id} has link row(s) with ` +
                        'disagreeing or unrecognized entity_type — left at product_domain=commerce.'
                );
            } else {
                subscriptionsWithoutLinkRow += 1;
                logger.warn(
                    `HOS-692 domain rewrite: subscription ${sub.id} has no link row — ` +
                        'left at product_domain=commerce (grants nothing to anybody).'
                );
            }
            continue;
        }

        // The same pair of statements, driven by the same resolved vertical —
        // the two columns can never end up disagreeing.
        await db
            .update(billingSubscriptions)
            .set({ productDomain: vertical })
            .where(eq(billingSubscriptions.id, sub.id));
        subscriptionsRewritten += 1;

        const updatedLinks = await db
            .update(commerceListingSubscriptions)
            .set({ productDomain: vertical })
            .where(
                and(
                    eq(commerceListingSubscriptions.subscriptionId, sub.id),
                    eq(commerceListingSubscriptions.productDomain, ProductDomainEnum.COMMERCE)
                )
            )
            .returning({ id: commerceListingSubscriptions.id });
        linkRowsRewritten += updatedLinks.length;
    }

    return {
        subscriptionsRewritten,
        linkRowsRewritten,
        subscriptionsWithoutLinkRow,
        subscriptionsWithAmbiguousLinkRows
    };
}

/**
 * Part 2: plan catalogue cleanup (spec §6.9) — hard-deletes the 3 unused
 * `complex-*` plans (re-verifying zero live subscriptions per plan before
 * deleting, since `billing_subscriptions.plan_id` carries no enforced FK),
 * deactivates + soft-deletes `tourist-plus` / `owner-test-daily`, and strips
 * the dead `metadata.monthlyPriceArs` mirror from every plan row.
 */
async function cleanupPlanCatalogue(ctx: SeedMigrationCtx): Promise<SeedMigrationResult['counts']> {
    const { db } = ctx;

    // ── complex-*: hard delete, re-verified live-subscription-free ──────────
    let complexPlansDeleted = 0;
    let complexPlansSkippedLiveSubscription = 0;

    for (const slug of COMPLEX_PLAN_SLUGS) {
        const [plan] = await db
            .select({ id: billingPlans.id })
            .from(billingPlans)
            .where(and(eq(billingPlans.name, slug), isNull(billingPlans.deletedAt)))
            .limit(1);

        if (!plan) {
            continue; // already removed by an earlier run, or never seeded here
        }

        // plan_id is a varchar with NO enforced FK to billing_plans.id — a
        // wrong "0 live subscriptions" assumption would not error on DELETE,
        // it would silently orphan a real subscription's plan lookup.
        const [liveSub] = await db
            .select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.planId, plan.id))
            .limit(1);

        if (liveSub) {
            complexPlansSkippedLiveSubscription += 1;
            logger.warn(
                `HOS-692 plan cleanup: plan "${slug}" (${plan.id}) has a subscription ` +
                    `referencing it (${liveSub.id}) — refusing to hard-delete, contradicts the ` +
                    'issue inventory of zero live subscriptions.'
            );
            continue;
        }

        // billing_prices rows cascade (planId REFERENCES billing_plans.id ON DELETE CASCADE).
        await db.delete(billingPlans).where(eq(billingPlans.id, plan.id));
        complexPlansDeleted += 1;
    }

    // ── tourist-plus / owner-test-daily: deactivate + soft-delete only ──────
    let softDeletedPlans = 0;
    const now = new Date();
    for (const slug of SOFT_DELETED_PLAN_SLUGS) {
        const updated = await db
            .update(billingPlans)
            .set({ active: false, deletedAt: now, updatedAt: now })
            .where(and(eq(billingPlans.name, slug), isNull(billingPlans.deletedAt)))
            .returning({ id: billingPlans.id });
        softDeletedPlans += updated.length;
    }

    // ── metadata.monthlyPriceArs mirror: stripped from every plan row ───────
    // Raw SQL: Drizzle has no typed "delete a JSONB key" helper. The `?`
    // containment operator + `-` key-delete operator are both native jsonb.
    const strippedResult = await db.execute(
        sql`UPDATE billing_plans
            SET metadata = metadata - 'monthlyPriceArs'
            WHERE metadata ? 'monthlyPriceArs'`
    );
    const metadataMirrorsStripped =
        typeof strippedResult.rowCount === 'number' ? strippedResult.rowCount : 0;

    return {
        complexPlansDeleted,
        complexPlansSkippedLiveSubscription,
        softDeletedPlans,
        metadataMirrorsStripped
    };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const domainCounts = await rewriteCommerceDomain(ctx);
    const planCounts = await cleanupPlanCatalogue(ctx);

    return {
        summary:
            `Domain rewrite: ${domainCounts?.subscriptionsRewritten ?? 0} subscription(s) + ` +
            `${domainCounts?.linkRowsRewritten ?? 0} link row(s) rewritten, ` +
            `${domainCounts?.subscriptionsWithoutLinkRow ?? 0} left at 'commerce' (no link row), ` +
            `${domainCounts?.subscriptionsWithAmbiguousLinkRows ?? 0} left at 'commerce' (ambiguous). ` +
            `Plan cleanup: ${planCounts?.complexPlansDeleted ?? 0} complex plan(s) deleted, ` +
            `${planCounts?.softDeletedPlans ?? 0} plan(s) deactivated+soft-deleted, ` +
            `${planCounts?.metadataMirrorsStripped ?? 0} metadata.monthlyPriceArs mirror(s) stripped.`,
        counts: { ...domainCounts, ...planCounts }
    };
}
