/**
 * @fileoverview
 * Data migration: 0081-hos-734-commerce-view-basic-stats-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-734. The baseline gains
 * `EntitlementKey.VIEW_BASIC_STATS` on ALL SIX commerce plan rows (both
 * verticals, all three tiers each); this migration applies the same delta to
 * an already-seeded database.
 *
 * ## Why the baseline edit alone is not enough
 *
 * Same two seeders as `0077`/`0080`, and neither reaches an existing
 * environment:
 *
 * 1. `billing_entitlements` already carries a `view_basic_stats` row — it was
 *    seeded long ago for the accommodation catalogue (`ENTITLEMENT_DEFINITIONS`
 *    already lists it). This migration's lookup-row step is therefore expected
 *    to be a no-op in every real environment; it stays only for the same
 *    defensive reason `0077`/`0080` keep theirs — a migration must not assume
 *    what it cannot verify.
 * 2. `packages/seed/src/required/commercePlan.seed.ts` (`ensureCommercePlan`)
 *    matches by `name` and **INSERTS ONLY**: an existing plan row is skipped
 *    wholesale. The six commerce rows on staging and production would keep
 *    whatever `entitlements` array they already had (the `0077`/`0080` deltas,
 *    but not this one) forever.
 *
 * ## What this migration is NOT load-bearing for
 *
 * Same inversion `0077` states, and it applies identically here:
 * `commerceVerticalEntitlementMiddleware` resolves the vertical's entitlement
 * FLOOR from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — from code, in the same
 * binary as the gate — and only ever UNIONS the plan row's own `entitlements`
 * on top. `view_basic_stats` was added to that floor map directly (HOS-734),
 * so the `GET /mine/views` / `GET /mine/views/daily-series` routes work from
 * the moment the API deploys, with or without this migration having run.
 *
 * What the migration DOES fix is everything that reads the plan row directly
 * and cannot see the code floor: the public plans list
 * (`GET /api/v1/public/plans`), which is what the web plan-comparison table
 * and plan cards under `presentacion/gastronomia` / `presentacion/experiencias`
 * read to decide whether to show the "basic stats" row as included — the
 * admin plan editor's entitlement checkboxes, `config-drift-check`, and any
 * operator inspecting `billing_plans` directly. Leaving those describing a
 * state the platform is not in is exactly the HOS-789 shape the dual-write
 * rule exists to prevent.
 *
 * ## Idempotency
 *
 * - Lookup row: inserted only when no `billing_entitlements` row holds the key.
 * - Plan grants: the `entitlements` array is rewritten to the UNION of what the
 *   row already holds and the key, guarded on the row not already containing
 *   it. A re-run affects zero rows.
 *
 * ## OR-PRESERVE semantics
 *
 * Union, never replacement — same rule as `0077`/`0080`. An operator who
 * granted or revoked something else through the SPEC-168 admin editor keeps
 * their changes; this migration can only ever add the one key it owes.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert (expected no-op) and up to six additive
 * array unions. Nothing is deleted and no row is rewritten to a narrower value.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0081-hos-734-commerce-view-basic-stats-entitlement',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The lookup row, spelled as a literal — matching `ENTITLEMENT_DEFINITIONS`'s
 * existing `VIEW_BASIC_STATS` entry verbatim.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing
 * that delta even after a later baseline change edits the array underneath it
 * (the rule `0071`'s `TIER_PAIRS`, `0077`'s `NEW_ENTITLEMENTS`, and `0080`'s
 * `NEW_ENTITLEMENT` all state).
 */
const NEW_ENTITLEMENT = {
    key: 'view_basic_stats',
    name: 'Basic statistics',
    description: 'Access to basic visit and booking statistics'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * ALL SIX — every tier of both verticals, not just the sellable one.
 * `view_basic_stats` is the floor every tier of a vertical gets (mirrors
 * `0077`'s EDIT/PUBLISH pair, not `0080`'s premium-only PDF key): the retired
 * premium tiers still have live subscriptions hanging off them (see `0071`),
 * and an owner on one of those must not be the one person whose basic view
 * stats the plan-comparison page describes as missing.
 */
const PLAN_NAMES = [
    'gastronomy-basico',
    'gastronomy-pro',
    'gastronomy-premium',
    'experience-basico',
    'experience-pro',
    'experience-premium'
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let entitlementsCreated = 0;
    let plansGranted = 0;

    // ── 1. The `billing_entitlements` lookup row ─────────────────────────────
    const existing = await ctx.db
        .select({ id: billingEntitlements.id })
        .from(billingEntitlements)
        .where(eq(billingEntitlements.key, NEW_ENTITLEMENT.key))
        .limit(1);

    if (existing.length === 0) {
        await ctx.db.insert(billingEntitlements).values({
            key: NEW_ENTITLEMENT.key,
            name: NEW_ENTITLEMENT.name,
            description: NEW_ENTITLEMENT.description
        });
        entitlementsCreated += 1;
    }

    // ── 2. The plan grants ──────────────────────────────────────────────────
    // Read first rather than issuing a blind UPDATE: `entitlements` is a jsonb
    // array, and the union has to be computed against whatever the row
    // actually holds — including the `0077`/`0080` deltas and anything an
    // operator added through the admin editor.
    const rows = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, [...PLAN_NAMES]));

    for (const row of rows) {
        const current = Array.isArray(row.entitlements) ? (row.entitlements as string[]) : [];
        if (current.includes(NEW_ENTITLEMENT.key)) {
            continue;
        }

        await ctx.db
            .update(billingPlans)
            .set({
                entitlements: [...current, NEW_ENTITLEMENT.key],
                updatedAt: new Date()
            })
            .where(eq(billingPlans.id, row.id));

        plansGranted += 1;
    }

    const counts = { entitlementsCreated, plansGranted };
    const changed = entitlementsCreated + plansGranted > 0;

    const summary = changed
        ? `HOS-734: created ${entitlementsCreated} billing_entitlements row(s) and granted view_basic_stats on ${plansGranted} commerce plan row(s).`
        : 'HOS-734: view_basic_stats already granted on every commerce plan — no change.';

    // Deliberately not a warning: an environment with no commerce plan rows at
    // all (a fresh DB built from the baseline, where `commercePlan.seed.ts`
    // already inserted them with the grant via `commerceVerticalTier`) is a
    // correct state, not a half-applied one. And the API does not depend on
    // this having run — see the file header.
    return { summary, counts };
}
