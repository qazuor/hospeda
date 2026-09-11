/**
 * @fileoverview
 * Data migration: 0077-hos-1074-commerce-edit-publish-entitlements
 *
 * Dual-write counterpart (HOS-25) for HOS-1074. The baseline gains four
 * `EntitlementKey` members and grants them across both commerce catalogues;
 * this migration applies the same delta to an already-seeded database.
 *
 * ## Why the baseline edit alone is not enough
 *
 * Two seeders are involved and NEITHER reaches an existing environment:
 *
 * 1. `packages/seed/src/required/billingEntitlements.seed.ts` inserts one
 *    `billing_entitlements` lookup row per `ENTITLEMENT_DEFINITIONS` entry,
 *    skipping keys that already exist. It is additive and correct — but the
 *    required seed does not re-run on a live environment, so the four new
 *    lookup rows would simply never appear.
 * 2. `packages/seed/src/required/commercePlan.seed.ts` (`ensureCommercePlan`)
 *    matches by `name` and **INSERTS ONLY**: an existing plan row is skipped
 *    wholesale and only its `product_domain` is re-stamped. The six commerce
 *    rows on staging and production would keep `entitlements = []` forever.
 *
 * So this migration does both halves: the lookup rows, then the plan grants.
 *
 * ## What this migration is NOT load-bearing for
 *
 * Worth stating plainly, because it inverts the usual reading of a dual-write
 * migration. The API does **not** depend on this migration having run in order
 * to let commerce owners edit and publish. `commerceVerticalEntitlementMiddleware`
 * resolves the vertical's entitlement FLOOR from
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — from code, in the same binary as
 * the gate — and only ever UNIONS the plan row's own `entitlements` on top.
 * That is Model C's capability rule (config wins, the database follows), and it
 * is deliberate: it removes the deploy-then-migrate window in which the gate
 * would exist and the grant would not, which is the single failure HOS-1074 is
 * written around. A gate that read this table alone would have locked every
 * commerce owner out of their own listing for the length of that window.
 *
 * What the migration DOES fix is everything that reads the plan row directly
 * and cannot see the code floor: the admin plan editor's entitlement
 * checkboxes, `config-drift-check`, any operator inspecting `billing_plans`,
 * and any future consumer that resolves grants from the catalogue rather than
 * from the request context. Leaving those describing a state the platform is
 * not in is exactly the HOS-789 shape the dual-write rule exists to prevent.
 *
 * ## Idempotency
 *
 * - Lookup rows: inserted only when no `billing_entitlements` row holds the key.
 * - Plan grants: the `entitlements` array is rewritten to the UNION of what the
 *   row already holds and the vertical's pair, and the `UPDATE` is guarded on
 *   the row not already containing both keys. A re-run affects zero rows.
 *
 * ## OR-PRESERVE semantics
 *
 * Union, never replacement. An operator who granted an extra key to a commerce
 * plan through the SPEC-168 admin editor keeps it: this migration can only add
 * the two keys its vertical owes, never remove anything. That is the same
 * direction `0071`'s guarded UPDATEs chose, and it is the safe one here for a
 * second reason — an entitlement set that loses a member is a customer locked
 * out, not a discount.
 *
 * ## `destructive` flag decision
 *
 * `false`. No deletes, no row rewritten to a narrower value. Four additive
 * lookup inserts and six additive array unions.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0077-hos-1074-commerce-edit-publish-entitlements',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The four lookup rows, spelled as literals.
 *
 * Literals rather than a filter over `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, so it must keep describing
 * that delta even after a later baseline change edits or reorders the array
 * underneath it (the same rule `0071`'s `TIER_PAIRS` states).
 */
const NEW_ENTITLEMENTS = [
    {
        key: 'edit_gastronomy_info',
        name: 'Edit gastronomy info',
        description: 'Allows editing the information of owned gastronomy listings'
    },
    {
        key: 'publish_gastronomy',
        name: 'Publish gastronomy listings',
        description: 'Allows publishing gastronomy listings on the platform'
    },
    {
        key: 'edit_experience_info',
        name: 'Edit experience info',
        description: 'Allows editing the information of owned experience listings'
    },
    {
        key: 'publish_experience',
        name: 'Publish experience listings',
        description: 'Allows publishing experience listings on the platform'
    }
] as const;

/**
 * Which plan rows (by `billing_plans.name`, i.e. the slug) receive which pair.
 *
 * All three tiers of a vertical, not just the sellable one. Editing and
 * publishing your own listing is not a tier differentiator — the retired
 * premium tier still has live subscriptions hanging off it (see `0071`), and an
 * owner on that plan must not be the one person who cannot edit their listing.
 */
const GRANTS = [
    {
        vertical: 'gastronomy',
        planNames: ['gastronomy-basico', 'gastronomy-pro', 'gastronomy-premium'],
        keys: ['edit_gastronomy_info', 'publish_gastronomy']
    },
    {
        vertical: 'experience',
        planNames: ['experience-basico', 'experience-pro', 'experience-premium'],
        keys: ['edit_experience_info', 'publish_experience']
    }
] as const;

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let entitlementsCreated = 0;
    let plansGranted = 0;

    // ── 1. The `billing_entitlements` lookup rows ────────────────────────────
    for (const entitlement of NEW_ENTITLEMENTS) {
        const existing = await ctx.db
            .select({ id: billingEntitlements.id })
            .from(billingEntitlements)
            .where(eq(billingEntitlements.key, entitlement.key))
            .limit(1);

        if (existing.length > 0) {
            continue;
        }

        await ctx.db.insert(billingEntitlements).values({
            key: entitlement.key,
            name: entitlement.name,
            description: entitlement.description
        });
        entitlementsCreated += 1;
    }

    // ── 2. The plan grants ──────────────────────────────────────────────────
    for (const grant of GRANTS) {
        // Read first rather than issuing a blind UPDATE: `entitlements` is a
        // jsonb array, and the union has to be computed against whatever the
        // row actually holds — including anything an operator added through the
        // admin editor, which this migration must preserve.
        const rows = await ctx.db
            .select({
                id: billingPlans.id,
                name: billingPlans.name,
                entitlements: billingPlans.entitlements
            })
            .from(billingPlans)
            .where(inArray(billingPlans.name, [...grant.planNames]));

        for (const row of rows) {
            const current = Array.isArray(row.entitlements) ? (row.entitlements as string[]) : [];
            const missing = grant.keys.filter((key) => !current.includes(key));

            if (missing.length === 0) {
                // Already granted — a re-run, or an operator got there first.
                continue;
            }

            await ctx.db
                .update(billingPlans)
                .set({
                    entitlements: [...current, ...missing],
                    updatedAt: new Date()
                })
                .where(eq(billingPlans.id, row.id));

            plansGranted += 1;
        }
    }

    const counts = { entitlementsCreated, plansGranted };
    const changed = entitlementsCreated + plansGranted > 0;

    const summary = changed
        ? `HOS-1074: created ${entitlementsCreated} billing_entitlements row(s) and granted the vertical EDIT/PUBLISH pair on ${plansGranted} commerce plan row(s).`
        : 'HOS-1074: commerce edit/publish entitlements already present on every commerce plan — no change.';

    // Deliberately not a warning: an environment with no commerce plan rows at
    // all (a fresh DB built from the baseline, where `commercePlan.seed.ts`
    // already inserted them with the grants) is a correct state, not a
    // half-applied one. And the API does not depend on this having run — see
    // the file header.
    return { summary, counts };
}
