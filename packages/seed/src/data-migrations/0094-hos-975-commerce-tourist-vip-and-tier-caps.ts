/**
 * @fileoverview
 * Data migration: 0094-hos-975-commerce-tourist-vip-and-tier-caps
 *
 * Dual-write counterpart (HOS-25) for HOS-975's two remaining deltas, both
 * applied by `commerceVerticalTier` in `plans.config.ts`:
 *
 * 1. **D-A** — every commerce tier inherits `TOURIST_VIP_ENTITLEMENTS` (15 keys)
 *    and `TOURIST_VIP_LIMITS` (7 keys), the same two constants all six
 *    accommodation plans spread.
 * 2. **The per-tier listing cap** — gastronomy 1 / 3 / 5, experiences 1 / 5 / 10
 *    (owner decision, 2026-09-04). Until now all six rows carried `1`.
 *
 * ## Why the migration is required at all
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * INSERTS ONLY — an existing plan row is skipped wholesale. Editing
 * `plans.config.ts` therefore reaches a fresh `db:fresh` and nothing else.
 *
 * ## The limits half is not symmetry — it is the whole point
 *
 * Granting the 15 entitlements WITHOUT the 7 limits is worse than granting
 * neither. `max_ai_search_per_month` absent from a plan row is resolved as
 * UNLIMITED by the layers beneath (`commerce-limits.config.ts` opens with that
 * warning), so a commerce owner would hold an uncapped AI-search quota that a
 * paying tourist-VIP holds at 200. The two halves ship together or not at all.
 *
 * ## The cap half breaks 0093's rule, deliberately
 *
 * `0093` writes a limit ONLY when the key is absent, because limit values are a
 * `'commercial'` field and the database wins over config. That rule cannot
 * apply here: `max_gastronomies` / `max_experiences` are already PRESENT on all
 * six rows at `1`, so "write only when absent" would move nothing and leave
 * staging and production on the old cap forever while the baseline claimed
 * otherwise — the HOS-789 shape this whole carril exists to prevent.
 *
 * The precedent for the exception is in the repo and is narrow: extras migration
 * `014-spec211-ai-monetization.data.sql` overwrites a `'commercial'` limit value
 * scoped with `= '-1'`, i.e. only while the row still holds the value it was
 * seeded with. This migration does the same with `= 1`:
 *
 * - a row still at the seeded `1` is raised to its tier's new cap;
 * - a row an operator moved to anything else through the SPEC-168 admin editor
 *   keeps their value, untouched, and is counted as skipped.
 *
 * So the operator override survives and the decision still reaches the rows
 * nobody has touched, which is all of them on every environment today.
 *
 * The two `-basico` rows are absent from `CAP_RAISE_BY_PLAN_NAME` on purpose:
 * their cap is unchanged at `1`, so there is no delta to apply and a no-op entry
 * would only invite a future reader to think one was forgotten.
 *
 * ## The lookup rows are created when absent, not assumed
 *
 * A grant naming a key with no `billing_entitlements` row is a dangling grant,
 * so this migration inserts any of the 15 that is missing — exactly what `0093`
 * does for its single key, and the reason its own doc gives: "so a database
 * seeded from a narrower baseline is not left with a dangling grant".
 *
 * **This started out as the opposite, and CI disproved it.** The 15 have existed
 * since SPEC-216 on any environment that ran `pnpm seed --required`, so the
 * first version verified their presence and THREW naming the missing ones,
 * reasoning that a migration is not the place to author a catalogue entry. The
 * flaw is that the documented run order is `db:migrate` → `db:apply-extras` →
 * `db:seed:migrate` — the required seed is not in it. A database can therefore
 * legitimately hold the commerce PLAN rows (migration `0090` priced them) while
 * `billing_entitlements` is still nearly empty, which is exactly the state
 * `test/integration/cli-data-migrate.integration.test.ts` builds: 14 of the 15
 * missing, and this was the only one of the 94 migrations that aborted the run.
 *
 * Two guards survive from that first version and are worth keeping:
 *
 * - the migration asks whether ANY commerce plan row exists before doing
 *   anything, and returns a clean no-op when there are none — there is nothing
 *   to grant to, so there is nothing to create either;
 * - the names and descriptions inserted are copied verbatim from
 *   `ENTITLEMENT_DEFINITIONS` as it read on the day this was written, not
 *   imported, so a later baseline edit cannot silently change what this
 *   migration claims to have created.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * Touches `billing_entitlements` and `billing_plans` (`entitlements` and
 * `limits`, both long-existing JSON columns). HOS-975 ships no structural
 * migration.
 *
 * ## Idempotency
 *
 * - Lookup rows: inserted only when absent.
 * - Entitlements: the array is rewritten to the UNION of what the row holds and
 *   the 15 keys, so re-running adds nothing.
 * - Tourist-VIP limits: written per key only when that key is absent — purely
 *   additive, and an operator who tuned one keeps it.
 * - Cap: raised only while the row still reads exactly `1`. After the first run
 *   it reads 3/5/10 and the guard stops matching.
 *
 * A re-run affects zero rows.
 *
 * ## `destructive` flag decision
 *
 * `false`. Nothing is deleted and no row loses a grant or a key: conditional
 * lookup inserts, an additive array union, additive limit keys. The one
 * overwrite raises a cap — 1 → 3, 5 or 10 — so no subscriber can end up allowed
 * fewer listings than before it ran, which is the direction that would have
 * warranted the flag.
 */
import { billingEntitlements, billingPlans, eq, inArray } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0094-hos-975-commerce-tourist-vip-and-tier-caps',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The 15 tourist-VIP entitlements, spelled as literals — key, name and
 * description, so a missing lookup row can be created rather than refused on.
 *
 * Literal rather than imported from `TOURIST_VIP_ENTITLEMENTS` /
 * `ENTITLEMENT_DEFINITIONS`: a migration records the delta it applied on the day
 * it ran, and must keep describing that delta even after a later baseline change
 * edits the constants underneath it. `0093` spells its one entitlement out for
 * the same reason.
 */
const TOURIST_VIP_ENTITLEMENTS = [
    {
        key: 'save_favorites',
        name: 'Save favorites',
        description: 'Allows saving accommodations as favorites'
    },
    {
        key: 'write_reviews',
        name: 'Write reviews',
        description: 'Allows writing accommodation reviews'
    },
    {
        key: 'read_reviews',
        name: 'Read reviews',
        description: 'Access to read reviews from other guests'
    },
    {
        key: 'price_alerts',
        name: 'Price alerts',
        description: 'Notifications when favorite accommodation prices drop'
    },
    {
        key: 'exclusive_deals',
        name: 'Exclusive deals',
        description: 'Access to exclusive offers and discounts'
    },
    { key: 'vip_support', name: 'VIP support', description: 'Dedicated VIP support channel' },
    {
        key: 'vip_visibility_access',
        name: 'VIP visibility access',
        description:
            'VIP tourist visibility bypass: see RESTRICTED, owner-suspended, and plan-restricted accommodations'
    },
    {
        key: 'vip_promotions_access',
        name: 'VIP promotions access',
        description: 'Access to VIP-only tier exclusive deals, in addition to the plus tier'
    },
    {
        key: 'can_compare_accommodations',
        name: 'Compare accommodations',
        description: 'Allows comparing multiple accommodations side by side'
    },
    {
        key: 'can_attach_review_photos',
        name: 'Attach photos to reviews',
        description: 'Allows adding photos to accommodation reviews'
    },
    {
        key: 'can_view_search_history',
        name: 'View search history',
        description: 'Access to past search history'
    },
    {
        key: 'can_view_recommendations',
        name: 'Personalized recommendations',
        description: 'Access to personalized accommodation recommendations based on preferences'
    },
    {
        key: 'can_contact_whatsapp_display',
        name: 'Display WhatsApp',
        description: 'Allows displaying WhatsApp number in listing'
    },
    {
        key: 'can_contact_whatsapp_direct',
        name: 'Direct WhatsApp contact',
        description: 'Allows tourists to contact directly via WhatsApp'
    },
    {
        key: 'can_use_collections',
        name: 'Use favorites collections',
        description: 'Allows organizing saved favorites into named collections'
    }
] as const;

/** Just the keys, for the array-union work below. */
const TOURIST_VIP_ENTITLEMENT_KEYS = TOURIST_VIP_ENTITLEMENTS.map((e) => e.key);

/** The 7 tourist-VIP limit keys and their values, spelled out for the same reason. */
const TOURIST_VIP_LIMIT_VALUES: Readonly<Record<string, number>> = {
    max_favorites: -1,
    max_active_alerts: -1,
    max_compare_items: 5,
    max_ai_search_per_month: 200,
    max_ai_chat_consumer_per_month: 200,
    max_search_history_entries: 200,
    max_collections: 25
};

/** Every commerce plan row, in both verticals. All six receive the D-A grant. */
const COMMERCE_PLAN_NAMES = [
    'gastronomy-basico',
    'gastronomy-pro',
    'gastronomy-premium',
    'experience-basico',
    'experience-pro',
    'experience-premium'
] as const;

/**
 * The cap each tier is raised TO, and the value it is raised FROM.
 *
 * `from` is the seeded `1` every commerce row has carried since HOS-688; the
 * update is scoped to it so an operator's own value is never overwritten. The
 * two `-basico` tiers are absent because their cap does not move.
 */
const CAP_RAISE_BY_PLAN_NAME: Readonly<Record<string, { key: string; from: number; to: number }>> =
    {
        'gastronomy-pro': { key: 'max_gastronomies', from: 1, to: 3 },
        'gastronomy-premium': { key: 'max_gastronomies', from: 1, to: 5 },
        'experience-pro': { key: 'max_experiences', from: 1, to: 5 },
        'experience-premium': { key: 'max_experiences', from: 1, to: 10 }
    };

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let entitlementsCreated = 0;
    let plansGranted = 0;
    let vipLimitsWritten = 0;
    let capsRaised = 0;
    let capsSkippedByOperatorValue = 0;

    // ── 1. Is there anything to grant AT ALL? ────────────────────────────────
    // Asked BEFORE the lookup-row check, and the order is the whole point. A
    // database carrying the schema but no seed — which is exactly what
    // `test/integration/cli-data-migrate.integration.test.ts` runs the full
    // ledger against — has neither commerce plans nor `billing_entitlements`
    // rows. Checking the lookup rows first made this migration THROW there,
    // and it was the only one of the 94 that did: every other migration
    // reports "on 0 rows" and moves on.
    //
    // The fail-closed check below is still right, but it guards a real
    // hazard — granting a key no lookup row backs — and that hazard cannot
    // exist when there is no plan row to grant anything to. So an empty
    // catalogue is a clean no-op, not a refusal.
    const planRows = await ctx.db
        .select({
            id: billingPlans.id,
            name: billingPlans.name,
            entitlements: billingPlans.entitlements,
            limits: billingPlans.limits
        })
        .from(billingPlans)
        .where(inArray(billingPlans.name, [...COMMERCE_PLAN_NAMES]));

    if (planRows.length === 0) {
        return {
            summary: 'HOS-975: no commerce plan rows in this database — nothing to grant or cap.',
            counts: { entitlementsCreated: 0, plansGranted: 0, vipLimitsWritten: 0, capsRaised: 0 }
        };
    }

    // ── 2. Every tourist-VIP lookup row, created when absent ─────────────────
    // Exactly what `0093` does for its single key, and for the same reason: a
    // grant naming a key with no `billing_entitlements` row is a dangling
    // grant, so the row is made rather than assumed.
    //
    // Assumed at first, and CI disproved it. The 15 have existed since
    // SPEC-216 on any environment that ran `pnpm seed --required`, so this
    // originally verified their presence and THREW otherwise. But the
    // documented run order is `db:migrate` → `db:apply-extras` →
    // `db:seed:migrate`, which does not include the required seed — so a
    // database can legitimately hold the commerce PLAN rows (migration 0090
    // priced them) while `billing_entitlements` is still nearly empty. That is
    // precisely the state `cli-data-migrate.integration.test.ts` builds, where
    // 14 of the 15 were missing and this was the only one of the 94 migrations
    // that aborted the run.
    const lookupRows = await ctx.db
        .select({ key: billingEntitlements.key })
        .from(billingEntitlements)
        .where(inArray(billingEntitlements.key, [...TOURIST_VIP_ENTITLEMENT_KEYS]));

    const presentKeys = new Set(lookupRows.map((r) => r.key));
    const missingDefinitions = TOURIST_VIP_ENTITLEMENTS.filter((e) => !presentKeys.has(e.key));

    for (const definition of missingDefinitions) {
        await ctx.db.insert(billingEntitlements).values({
            key: definition.key,
            name: definition.name,
            description: definition.description
        });
        entitlementsCreated += 1;
    }

    // ── 3. Grant + limits, per commerce plan row ─────────────────────────────
    // The rows were read up front rather than re-queried per name: both columns
    // are JSON and each delta has to be computed against whatever the row
    // actually holds — the keys migrations 0077..0093 granted, plus anything an
    // operator added through the SPEC-168 admin editor.
    for (const row of planRows) {
        const planName = row.name;
        const currentEntitlements = Array.isArray(row.entitlements)
            ? (row.entitlements as string[])
            : [];
        const currentLimits =
            row.limits && typeof row.limits === 'object'
                ? (row.limits as Record<string, number>)
                : {};

        const missingGrants = TOURIST_VIP_ENTITLEMENT_KEYS.filter(
            (k) => !currentEntitlements.includes(k)
        );

        // Additive only: a key the row already declares keeps its value,
        // because limit values are a 'commercial' field.
        const missingVipLimits = Object.entries(TOURIST_VIP_LIMIT_VALUES).filter(
            ([key]) => !(key in currentLimits)
        );

        // The one deliberate overwrite, scoped to the seeded value.
        const capRaise = CAP_RAISE_BY_PLAN_NAME[planName];
        const capIsStillSeeded = capRaise ? currentLimits[capRaise.key] === capRaise.from : false;
        const capNeedsRaise = capRaise !== undefined && capIsStillSeeded;

        if (capRaise !== undefined && !capIsStillSeeded) {
            capsSkippedByOperatorValue += 1;
        }

        if (missingGrants.length === 0 && missingVipLimits.length === 0 && !capNeedsRaise) {
            continue;
        }

        const nextLimits: Record<string, number> = { ...currentLimits };
        for (const [key, value] of missingVipLimits) {
            nextLimits[key] = value;
        }
        if (capNeedsRaise && capRaise) {
            nextLimits[capRaise.key] = capRaise.to;
        }

        await ctx.db
            .update(billingPlans)
            .set({
                ...(missingGrants.length > 0
                    ? { entitlements: [...currentEntitlements, ...missingGrants] }
                    : {}),
                ...(missingVipLimits.length > 0 || capNeedsRaise ? { limits: nextLimits } : {}),
                updatedAt: new Date()
            })
            .where(eq(billingPlans.id, row.id));

        if (missingGrants.length > 0) {
            plansGranted += 1;
        }
        vipLimitsWritten += missingVipLimits.length;
        if (capNeedsRaise) {
            capsRaised += 1;
        }
    }

    const counts = {
        entitlementsCreated,
        plansGranted,
        vipLimitsWritten,
        capsRaised,
        capsSkippedByOperatorValue
    };
    const changed = entitlementsCreated + plansGranted + vipLimitsWritten + capsRaised > 0;

    const summary = changed
        ? `HOS-975: created ${entitlementsCreated} billing_entitlements row(s), ` +
          `granted the tourist-VIP block on ${plansGranted} commerce plan row(s), ` +
          `wrote ${vipLimitsWritten} tourist-VIP limit(s) and raised ${capsRaised} listing cap(s)` +
          (capsSkippedByOperatorValue > 0
              ? `; left ${capsSkippedByOperatorValue} cap(s) alone because an operator had already moved them off the seeded value.`
              : '.')
        : 'HOS-975: every commerce plan row already carries the tourist-VIP block and its tier cap — no change.';

    return { summary, counts };
}
