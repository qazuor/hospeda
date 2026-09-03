/**
 * @fileoverview
 * Data migration: 0082-hos-895-gastronomy-menu-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-895. The baseline gains one
 * `EntitlementKey` member — `manage_gastronomy_menu`, the structured carta —
 * and grants it on the PRO and PREMIUM gastronomy plans; this migration applies
 * the same delta to an already-seeded database.
 *
 * ## Why it is load-bearing
 *
 * The same reason `0080` gives for `download_listing_pdf`, and for the same
 * shape of key. `manage_gastronomy_menu` is a TIER differentiator, so it is
 * deliberately absent from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that map
 * is the floor EVERY tier of a vertical receives, and a paid capability placed
 * there would be handed to `gastronomy-basico` too. The grant therefore lives
 * on the plan ROW and reaches the gate through the union
 * `resolveCommerceVerticalGrants` performs over the subscribed plan's
 * `entitlements` column.
 *
 * The window to be honest about: between this deploying and this migration
 * running, a `-pro`/`-premium` subscriber is refused the carta editor. It fails
 * CLOSED, not open, and today it is empty in practice — HOS-818 retired both
 * `-premium` tiers from sale and `-pro` was never enabled (`isActive: false`),
 * so no subscriber can currently be sitting on either plan.
 *
 * ## Why BOTH tiers and not only pro
 *
 * `-premium` outranks `-pro` in price and sort order. These `entitlements`
 * arrays are literal per plan — nothing composes a tier out of the one below it
 * — so granting only `-pro` would leave the dearer plan missing a feature its
 * cheaper neighbour has. Same reasoning as `plans.config.ts`.
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
 * Union, never replacement — same rule as `0077` and `0080`. An operator who
 * granted an extra key through the SPEC-168 admin editor keeps it, and the keys
 * `0077`/`0080` granted are read back and preserved rather than overwritten.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and two additive array unions. Nothing is
 * deleted and no row is rewritten to a narrower value.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0082-hos-895-gastronomy-menu-entitlement',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The lookup row, spelled as a literal.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the array underneath it (the
 * rule `0071`'s `TIER_PAIRS` and `0080`'s `NEW_ENTITLEMENT` both state).
 */
const NEW_ENTITLEMENT = {
    key: 'manage_gastronomy_menu',
    name: 'Structured gastronomy menu',
    description:
        'Allows building the venue menu as sections and dishes with names, descriptions and prices, instead of only linking or uploading it'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * Gastronomy only. An experience has no carta, so there is no experience plan
 * to grant this to — the asymmetry with `0080`, which touched both verticals.
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
    // holds — including the keys 0077 and 0080 granted, and anything an
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
        ? `HOS-895: created ${entitlementsCreated} billing_entitlements row(s) and granted manage_gastronomy_menu on ${plansGranted} gastronomy plan row(s).`
        : 'HOS-895: manage_gastronomy_menu already granted on every pro/premium gastronomy plan — no change.';

    return { summary, counts };
}
