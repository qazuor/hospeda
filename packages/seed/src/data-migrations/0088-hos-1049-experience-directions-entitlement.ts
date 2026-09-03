/**
 * @fileoverview
 * Data migration: 0088-hos-1049-experience-directions-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-1049. The baseline gains one
 * `EntitlementKey` member — `manage_experience_directions`, how to GET to an
 * experience's meeting point — and grants it on the PRO and PREMIUM experience
 * plans; this migration applies the same delta to an already-seeded database.
 *
 * ## Why it is load-bearing
 *
 * The same reason `0082` gives for `manage_gastronomy_menu`, and for the same
 * shape of key. `manage_experience_directions` is a TIER differentiator, so it
 * is deliberately absent from `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — that
 * map is the floor EVERY tier of a vertical receives, and a paid capability
 * placed there would be handed to `experience-basico` too. The grant therefore
 * lives on the plan ROW and reaches the gate through the union
 * `resolveCommerceVerticalGrants` performs over the subscribed plan's
 * `entitlements` column.
 *
 * The window to be honest about: between this deploying and this migration
 * running, a `-pro`/`-premium` subscriber is refused the directions editor and
 * their public ficha shows no map. It fails CLOSED, not open — and today it is
 * empty in practice for a stronger reason than gastronomy's was: BOTH
 * experience tiers named here are `isActive: false` (HOS-818 retired
 * `-premium`; `-pro` was never enabled and is still unpriced), so no subscriber
 * can currently be sitting on either plan. HOS-1049 deliberately did not
 * activate `-pro`: that is a commercial decision, not an implementation one.
 *
 * ## Why BOTH tiers and not only pro
 *
 * `-premium` outranks `-pro` in price and sort order. These `entitlements`
 * arrays are literal per plan — nothing composes a tier out of the one below it
 * — so granting only `-pro` would leave the dearer plan missing a feature its
 * cheaper neighbour has. Same reasoning as `plans.config.ts` and as `0082`.
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
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and two additive array unions. Nothing is
 * deleted and no row is rewritten to a narrower value.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0088-hos-1049-experience-directions-entitlement',
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
    key: 'manage_experience_directions',
    name: 'Meeting point map and directions',
    description:
        'Allows publishing how to reach the meeting point — where to park, which bus, how far the walk is — and drawing it on a map, on top of the meeting point address every tier already carries'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * Experience only. A restaurant has an address and a door, so there is no
 * gastronomy plan to grant this to — the mirror image of `0082`, which was
 * gastronomy-only for the equivalent reason.
 */
const GRANTED_PLAN_NAMES = ['experience-pro', 'experience-premium'] as const;

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
    // holds — including the keys 0077, 0080 and 0081 granted, and anything an
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
        ? `HOS-1049: created ${entitlementsCreated} billing_entitlements row(s) and granted manage_experience_directions on ${plansGranted} experience plan row(s).`
        : 'HOS-1049: manage_experience_directions already granted on every pro/premium experience plan — no change.';

    return { summary, counts };
}
