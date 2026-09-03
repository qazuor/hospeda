/**
 * @fileoverview
 * Data migration: 0087-hos-1057-experience-certificate-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-1057. The baseline gains one
 * `EntitlementKey` member — `issue_experience_certificate`, the certificate a
 * provider issues to whoever did the experience — and grants it on the PRO and
 * PREMIUM tiers of the EXPERIENCE vertical; this migration applies the same
 * delta to an already-seeded database.
 *
 * ## Load-bearing, for the same reason 0080 is
 *
 * `0077` explains why the four vertical-wide commerce keys do NOT depend on a
 * data migration: `commerceVerticalEntitlementMiddleware` resolves them from
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`, from CODE, and the plan row can only
 * union on top.
 *
 * This key is the opposite case, deliberately. It is a TIER differentiator
 * (`experience-pro` and upwards — owner decision, 2026-09-01), and that map is
 * the floor EVERY tier of a vertical receives. Putting it there would hand it to
 * `experience-basico`, which is the only sellable experience tier there is — the
 * give-away would reach every paying experience owner. So the grant lives on the
 * plan ROW and reaches the gate through the union
 * `resolveCommerceVerticalGrants` performs over the subscribed plan's
 * `entitlements` column.
 *
 * The window between deploy and migration fails CLOSED — a `-pro` subscriber
 * would be refused their own certificates — and today it is empty in practice:
 * `experience-pro` ships `isActive: false` and unpriced, so nobody can be on it.
 * Granting a tier a capability and putting that tier on sale are two separate
 * decisions and HOS-1057 only made the first.
 *
 * ## Idempotency
 *
 * - Lookup row: inserted only when no `billing_entitlements` row holds the key.
 * - Plan grants: `entitlements` is rewritten to the UNION of what the row holds
 *   and the key, guarded on the row not already containing it. A re-run affects
 *   zero rows.
 *
 * ## OR-PRESERVE semantics
 *
 * Union, never replacement — the same rule `0077` and `0080` follow. An operator
 * who granted an extra key through the SPEC-168 admin editor keeps it, and this
 * migration can only ever add the one key it owes.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and at most two additive array unions.
 * Nothing is deleted and no row is rewritten to a narrower value — in
 * particular, the keys `0077` and `0080` granted are read back and preserved.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0087-hos-1057-experience-certificate-entitlement',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The lookup row, spelled as a literal.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the array underneath it (the
 * rule `0071`'s `TIER_PAIRS` and `0077`'s `NEW_ENTITLEMENTS` both state).
 */
const NEW_ENTITLEMENT = {
    key: 'issue_experience_certificate',
    name: 'Experience certificates',
    description:
        'Allows issuing a printable certificate to a person who did the experience, naming them, the outing and its date'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * The `-pro` and `-premium` tiers of the EXPERIENCE vertical and nothing else.
 * `-premium` is listed explicitly rather than inherited: the baseline's
 * `entitlements` arrays are literal per plan and nothing composes a tier from
 * the one below it, so a dearer plan that is not named here would silently lack
 * a feature its cheaper neighbour has. Gastronomy is absent because a restaurant
 * has nothing to certify.
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

    // ── 2. The experience plan grants ────────────────────────────────────────
    // Read first rather than issuing a blind UPDATE: `entitlements` is a jsonb
    // array and the union has to be computed against whatever the row actually
    // holds — including the keys 0077 and 0080 granted and anything an operator
    // added through the admin editor.
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
        ? `HOS-1057: created ${entitlementsCreated} billing_entitlements row(s) and granted issue_experience_certificate on ${plansGranted} experience plan row(s).`
        : 'HOS-1057: issue_experience_certificate already granted on every experience plan — no change.';

    return { summary, counts };
}
