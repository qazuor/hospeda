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
 * ## The lookup rows are checked, never invented
 *
 * All 15 tourist-VIP keys have existed in `billing_entitlements` since SPEC-216
 * — `TOURIST_VIP_PLAN` and all six owner plans already grant them, and the
 * required seed upserts `ENTITLEMENT_DEFINITIONS` whole. This migration verifies
 * they are present and THROWS naming the missing ones rather than inserting
 * rows of its own: a grant pointing at a lookup row that does not exist is a
 * dangling grant, and a migration is not the place to author a catalogue entry's
 * name and description. A failure here means the environment was seeded from a
 * narrower baseline, and `pnpm seed --required` is the fix.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * Touches `billing_entitlements` (read only) and `billing_plans` (`entitlements`
 * and `limits`, both long-existing JSON columns). HOS-975 ships no structural
 * migration.
 *
 * ## Idempotency
 *
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
 * `false`. Nothing is deleted and no row loses a grant or a key. The one
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
 * The 15 tourist-VIP entitlement keys, spelled as literals.
 *
 * Literal rather than imported from `TOURIST_VIP_ENTITLEMENTS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the constant underneath it.
 * `0093` spells its one key out for the same reason.
 */
const TOURIST_VIP_ENTITLEMENT_KEYS = [
    'save_favorites',
    'write_reviews',
    'read_reviews',
    'price_alerts',
    'exclusive_deals',
    'vip_support',
    'vip_visibility_access',
    'vip_promotions_access',
    'can_compare_accommodations',
    'can_attach_review_photos',
    'can_view_search_history',
    'can_view_recommendations',
    'can_contact_whatsapp_display',
    'can_contact_whatsapp_direct',
    'can_use_collections'
] as const;

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
    let plansGranted = 0;
    let vipLimitsWritten = 0;
    let capsRaised = 0;
    let capsSkippedByOperatorValue = 0;

    // ── 1. Every tourist-VIP lookup row must already exist ───────────────────
    // Verified, never created: see the fileoverview. A missing row here means
    // the environment was seeded from a narrower baseline than SPEC-216's.
    const lookupRows = await ctx.db
        .select({ key: billingEntitlements.key })
        .from(billingEntitlements)
        .where(inArray(billingEntitlements.key, [...TOURIST_VIP_ENTITLEMENT_KEYS]));

    const presentKeys = new Set(lookupRows.map((r) => r.key));
    const missingKeys = TOURIST_VIP_ENTITLEMENT_KEYS.filter((k) => !presentKeys.has(k));

    if (missingKeys.length > 0) {
        throw new Error(
            `HOS-975: cannot grant the tourist-VIP block to the commerce plans — ` +
                `${missingKeys.length} of ${TOURIST_VIP_ENTITLEMENT_KEYS.length} lookup row(s) ` +
                `are missing from billing_entitlements: ${missingKeys.join(', ')}. ` +
                `Granting them anyway would leave dangling grants. Run ` +
                `\`pnpm seed --required\` to upsert ENTITLEMENT_DEFINITIONS, then re-run.`
        );
    }

    // ── 2. Grant + limits, per commerce plan row ─────────────────────────────
    // Read first rather than issuing a blind UPDATE: both columns are JSON and
    // each delta has to be computed against whatever the row actually holds —
    // the keys migrations 0077..0093 granted, plus anything an operator added
    // through the SPEC-168 admin editor.
    for (const planName of COMMERCE_PLAN_NAMES) {
        const rows = await ctx.db
            .select({
                id: billingPlans.id,
                entitlements: billingPlans.entitlements,
                limits: billingPlans.limits
            })
            .from(billingPlans)
            .where(eq(billingPlans.name, planName));

        for (const row of rows) {
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
            const capIsStillSeeded = capRaise
                ? currentLimits[capRaise.key] === capRaise.from
                : false;
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
    }

    const counts = { plansGranted, vipLimitsWritten, capsRaised, capsSkippedByOperatorValue };
    const changed = plansGranted + vipLimitsWritten + capsRaised > 0;

    const summary = changed
        ? `HOS-975: granted the tourist-VIP block on ${plansGranted} commerce plan row(s), ` +
          `wrote ${vipLimitsWritten} tourist-VIP limit(s) and raised ${capsRaised} listing cap(s)` +
          (capsSkippedByOperatorValue > 0
              ? `; left ${capsSkippedByOperatorValue} cap(s) alone because an operator had already moved them off the seeded value.`
              : '.')
        : 'HOS-975: every commerce plan row already carries the tourist-VIP block and its tier cap — no change.';

    return { summary, counts };
}
