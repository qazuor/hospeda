/**
 * @fileoverview
 * Data migration: 0085-hos-1041-gastronomy-daily-special-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-1041. The baseline gains one
 * `EntitlementKey` member — `manage_gastronomy_daily_special`, the menú del día
 * — and grants it on the PRO and PREMIUM gastronomy plans; this migration
 * applies the same delta to an already-seeded database.
 *
 * Structurally identical to `0082`, which did this for the carta three days
 * earlier, and the resemblance is the point: the same shape of key needs the
 * same shape of migration, and deviating from it would be the interesting thing
 * to explain, not following it.
 *
 * ## Why it is load-bearing
 *
 * `manage_gastronomy_daily_special` is a TIER differentiator, so it is
 * deliberately absent from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map
 * is the floor EVERY tier of a vertical receives, and a paid capability placed
 * there would be handed to `gastronomy-basico` too. The grant therefore lives
 * on the plan ROW and reaches the gate through the union
 * `resolveCommerceVerticalGrants` performs over the subscribed plan's
 * `entitlements` column. Without this migration, staging and production would
 * ship the route, the editor and the public renderer, and no subscriber could
 * reach any of them.
 *
 * The window to be honest about: between this deploying and this migration
 * running, a `-pro`/`-premium` subscriber is refused the menú del día editor.
 * It fails CLOSED, not open. Unlike `0082`'s window, this one is NOT
 * empty in practice — HOS-895 PR2 activated `gastronomy-pro` for sale and
 * HOS-1119 made it reachable, so a real subscriber may now be sitting on that
 * plan. Run order on a live environment is unchanged (`db:migrate` →
 * `db:apply-extras` → `db:seed:migrate`); the point is only that the gap is now
 * observable by a paying customer rather than theoretical, so the seed step is
 * not optional on this release.
 *
 * ## Why BOTH tiers and not only pro
 *
 * `-premium` outranks `-pro` in price and sort order. These `entitlements`
 * arrays are literal per plan — nothing composes a tier out of the one below it
 * — so granting only `-pro` would leave the dearer plan missing a feature its
 * cheaper neighbour has. Same reasoning as `plans.config.ts` and `0082`.
 *
 * ## Idempotency
 *
 * - Lookup row: inserted only when no `billing_entitlements` row holds the key.
 * - Plan grants: the `entitlements` array is rewritten to the UNION of what the
 *   row holds and the key, guarded on the row not already containing it. A
 *   re-run affects zero rows.
 *
 * ## OR-PRESERVE semantics
 *
 * Union, never replacement — same rule as `0077`, `0080` and `0082`. An
 * operator who granted an extra key through the SPEC-168 admin editor keeps it,
 * and the keys those migrations granted are read back and preserved rather than
 * overwritten.
 *
 * ## No table backfill
 *
 * HOS-1041 also creates `gastronomy_daily_specials` (drizzle migration `0107`),
 * but there is nothing to backfill INTO it: a menú del día is content an owner
 * types, and no pre-existing column holds one. The structural carril creates
 * the empty table; this file only opens the gate to writing in it.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and two additive array unions. Nothing is
 * deleted and no row is rewritten to a narrower value.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0085-hos-1041-gastronomy-daily-special-entitlement',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The lookup row, spelled as a literal.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the array underneath it (the
 * rule `0071`'s `TIER_PAIRS` and `0080`/`0082`'s `NEW_ENTITLEMENT` all state).
 */
const NEW_ENTITLEMENT = {
    key: 'manage_gastronomy_daily_special',
    name: 'Menú del día',
    description:
        'Allows publishing a dish of the day with its own validity window, which stops being shown on the public page when the window passes'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * Gastronomy only. An experience has no plato del día, so there is no
 * experience plan to grant this to — the same asymmetry `0082` has, and the
 * opposite of `0080`, which touched both verticals.
 */
const GRANTED_PLAN_NAMES = ['gastronomy-pro', 'gastronomy-premium'] as const;

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
    // array and the union has to be computed against whatever the row actually
    // holds — including the keys 0077, 0080 and 0082 granted, and anything an
    // operator added through the admin editor.
    const rows = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, [...GRANTED_PLAN_NAMES]));

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
        ? `HOS-1041: created ${entitlementsCreated} billing_entitlements row(s) and granted manage_gastronomy_daily_special on ${plansGranted} gastronomy plan row(s).`
        : 'HOS-1041: manage_gastronomy_daily_special already granted on every pro/premium gastronomy plan — no change.';

    return { summary, counts };
}
