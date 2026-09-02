/**
 * @fileoverview
 * Data migration: 0080-hos-1058-listing-pdf-entitlement
 *
 * Dual-write counterpart (HOS-25) for HOS-1058. The baseline gains one
 * `EntitlementKey` member — `download_listing_pdf`, the printable PDF ficha —
 * and grants it on the PREMIUM plan of each commerce vertical; this migration
 * applies the same delta to an already-seeded database.
 *
 * ## Why this one IS load-bearing, unlike 0077
 *
 * `0077` explains at length that the API does not depend on it: the four
 * vertical-wide commerce keys are resolved by
 * `commerceVerticalEntitlementMiddleware` from
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — from CODE — and the plan row can
 * only union on top.
 *
 * This key is the opposite case, and deliberately so. It is a TIER
 * differentiator (premium, in both verticals — owner decision, 2026-09-01), and
 * that map is the floor EVERY tier of a vertical receives. Putting a
 * premium-only capability there would hand it to `-basico` as well, which is
 * the exact give-away the tier exists to prevent. So the grant lives on the
 * premium plan ROW, reaching the gate through the union
 * `resolveCommerceVerticalGrants` performs over the subscribed plan's
 * `entitlements` column — the path HOS-1074 described as "how a future premium
 * tier earns its name".
 *
 * The consequence to be honest about: between this deploying and this migration
 * running, a premium subscriber is refused their own brochure. That window is
 * the deploy order (`db:migrate` → `db:apply-extras` → `db:seed:migrate`), it
 * fails CLOSED rather than open, and today it is empty in practice — HOS-818
 * retired both `-premium` tiers from sale (`isActive: false`), so no new
 * subscriber can land on one while it lasts.
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
 * Union, never replacement — same rule as `0077`. An operator who granted an
 * extra key through the SPEC-168 admin editor keeps it, and this migration can
 * only ever add the one key it owes.
 *
 * ## `destructive` flag decision
 *
 * `false`. One additive lookup insert and two additive array unions. Nothing is
 * deleted and no row is rewritten to a narrower value — in particular, the four
 * keys `0077` granted are read back and preserved, not overwritten.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0080-hos-1058-listing-pdf-entitlement',
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
    key: 'download_listing_pdf',
    name: 'Downloadable PDF listing sheet',
    description:
        'Allows downloading a print-ready PDF of the listing public page — photo, hours, contact and a QR back to the online sheet'
} as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive the key.
 *
 * The PREMIUM tier of each vertical and nothing else. R-1: gastronomy and
 * experiences are separate domains, so the same capability is granted to each
 * vertical's plan on its own — there is no shared "commerce" plan to grant it
 * once.
 */
const PREMIUM_PLAN_NAMES = ['gastronomy-premium', 'experience-premium'] as const;

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

    // ── 2. The premium plan grants ──────────────────────────────────────────
    // Read first rather than issuing a blind UPDATE: `entitlements` is a jsonb
    // array and the union has to be computed against whatever the row actually
    // holds — including the four keys 0077 granted and anything an operator
    // added through the admin editor.
    const rows = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, [...PREMIUM_PLAN_NAMES]));

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
        ? `HOS-1058: created ${entitlementsCreated} billing_entitlements row(s) and granted download_listing_pdf on ${plansGranted} premium commerce plan row(s).`
        : 'HOS-1058: download_listing_pdf already granted on every premium commerce plan — no change.';

    return { summary, counts };
}
