/**
 * @fileoverview
 * Data migration: 0002-billing-plans-collections-limit
 *
 * Ports `packages/db/src/migrations/extras/024-billing-plans-collections-limit.plan.sql`
 * (SPEC-287 — Favorites Collections, Per-Plan Limits) into the versioned seed
 * data-migration carril (HOS-25, T-020).
 *
 * Moves favorites collections from a global env-var cap
 * (`HOSPEDA_MAX_COLLECTIONS_PER_USER`, removed by SPEC-287 T-009) to a
 * per-plan billing entitlement + limit. Seeds both facets onto every
 * ACCOMMODATION `billing_plans` row:
 *
 *   - `can_use_collections` (entitlements array) — whether the plan may use
 *     favorites collections at all. `tourist-free` does NOT get it.
 *   - `max_collections` (limits JSONB)           — the per-plan collection cap.
 *
 * Value table (matches `packages/billing/src/config/plans.config.ts`,
 * unchanged from the original extras file):
 *
 *   Plan slug (name)     entitlement            max_collections
 *   ────────────────     ─────────────────────  ───────────────
 *   tourist-free         (none)                 (none)
 *   tourist-plus         can_use_collections     10
 *   tourist-vip          can_use_collections     25
 *   owner-basico         can_use_collections     25   (inherits tourist-VIP tier)
 *   owner-pro            can_use_collections     25   (inherits tourist-VIP tier)
 *   owner-premium        can_use_collections     25   (inherits tourist-VIP tier)
 *   complex-basico       can_use_collections     25   (inherits tourist-VIP tier)
 *   complex-pro          can_use_collections     25   (inherits tourist-VIP tier)
 *   complex-premium      can_use_collections     25   (inherits tourist-VIP tier)
 *
 * EXCLUDED: commerce-listing and partner-listing plan slugs (different
 * `product_domain` — same exclusion as `0001-billing-plans-ai-consumer-search-limits`).
 *
 * ## OR-PRESERVE semantics
 *
 * - The `can_use_collections` grant only appends when it is NOT already
 *   present in the `entitlements` array (`NOT ('can_use_collections' = ANY(entitlements))`).
 *   `entitlements` is classified `'commercial'` in Model C
 *   (`packages/billing/src/config/model-c-field-split.ts`) since HOS-39 — the
 *   admin `PlanDialog.tsx` (SPEC-168) lets operators toggle entitlements
 *   directly, so this migration must never clobber an operator's manual
 *   revocation. Appending only when absent preserves that.
 * - The `max_collections` limit is guarded with `NOT (limits ? 'max_collections')`,
 *   matching `limitsValues`'s `'commercial'` classification the same way
 *   `0001-billing-plans-ai-consumer-search-limits` does.
 *
 * Re-running `up()` against an already-migrated database is always a no-op
 * (zero affected rows) once both facets are present, and a migration that
 * revoked `can_use_collections` from a plan via the admin UI stays revoked —
 * this migration only ever adds, it never re-adds after a deliberate removal
 * is impossible to distinguish from "never had it" with an array-membership
 * check alone, but that mirrors the original `.plan.sql`'s exact behavior
 * (it has the same limitation) — not a regression introduced by this port.
 *
 * As with `0001-billing-plans-ai-consumer-search-limits`, the defensive
 * `information_schema.tables` existence check from the original `.plan.sql`
 * is omitted: the seed data-migration runner only runs after the structural
 * migration that creates `billing_plans` has already applied.
 */
import { and, billingPlans, type DrizzleClient, inArray, sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0002-billing-plans-collections-limit',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

const ENTITLEMENT_KEY = 'can_use_collections';
const LIMIT_KEY = 'max_collections';

/** Every plan that gets the `can_use_collections` entitlement (tourist-free excluded by design). */
const ENTITLED_PLANS = [
    'tourist-plus',
    'tourist-vip',
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

const TOURIST_PLUS_PLANS = ['tourist-plus'] as const;
const TWENTY_FIVE_CAP_PLANS = [
    'tourist-vip',
    'owner-basico',
    'owner-pro',
    'owner-premium',
    'complex-basico',
    'complex-pro',
    'complex-premium'
] as const;

/**
 * OR-PRESERVE append of `key` onto the `entitlements` array of every
 * `billing_plans` row whose `name` is in `planNames`, only when `key` is not
 * already present. Mirrors the original `.plan.sql`'s
 * `array_append(entitlements, key) WHERE NOT (key = ANY(entitlements))` guard
 * exactly.
 *
 * @returns The number of rows actually updated.
 */
async function orPreserveEntitlement(
    db: DrizzleClient,
    key: string,
    planNames: readonly string[]
): Promise<number> {
    const updated = await db
        .update(billingPlans)
        .set({
            entitlements: sql`array_append(${billingPlans.entitlements}, ${key})`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...planNames]),
                sql`NOT (${key} = ANY(${billingPlans.entitlements}))`
            )
        )
        .returning({ id: billingPlans.id });

    return updated.length;
}

/**
 * OR-PRESERVE merge of a single numeric limit key onto every `billing_plans`
 * row whose `name` is in `planNames`, only when that key is not already
 * present in `limits`. Same guard used by
 * `0001-billing-plans-ai-consumer-search-limits`'s `orPreserveLimit` (kept as
 * an independent copy per-file rather than a shared helper — see the T-020
 * handoff note on why these three migrations stay self-contained, matching
 * the original `.plan.sql` files' own independence).
 *
 * @returns The number of rows actually updated.
 */
async function orPreserveLimit(
    db: DrizzleClient,
    key: string,
    value: number,
    planNames: readonly string[]
): Promise<number> {
    const updated = await db
        .update(billingPlans)
        .set({
            limits: sql`${billingPlans.limits} || jsonb_build_object(${key}::text, ${value}::int)`,
            updatedAt: new Date()
        })
        .where(
            and(
                inArray(billingPlans.name, [...planNames]),
                sql`NOT (${billingPlans.limits} ? ${key})`
            )
        )
        .returning({ id: billingPlans.id });

    return updated.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const entitlementRowsUpdated = await orPreserveEntitlement(
        ctx.db,
        ENTITLEMENT_KEY,
        ENTITLED_PLANS
    );

    let limitRowsUpdated = 0;
    limitRowsUpdated += await orPreserveLimit(ctx.db, LIMIT_KEY, 10, TOURIST_PLUS_PLANS);
    limitRowsUpdated += await orPreserveLimit(ctx.db, LIMIT_KEY, 25, TWENTY_FIVE_CAP_PLANS);

    return {
        summary: `Set "${ENTITLEMENT_KEY}" on ${entitlementRowsUpdated} plan row(s), "${LIMIT_KEY}" on ${limitRowsUpdated} plan row(s).`,
        counts: {
            entitlementRowsUpdated,
            limitRowsUpdated
        }
    };
}
