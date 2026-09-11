/**
 * @fileoverview
 * Data migration: 0093-hos-400-commerce-ai-chat-grant-and-quota
 *
 * Dual-write counterpart (HOS-25) for HOS-400. The baseline grants
 * `EntitlementKey.AI_CHAT` on both commerce PREMIUM tiers and gives every
 * commerce tier a `max_ai_chat_<vertical>_per_month` cap; this migration
 * applies the same delta to an already-seeded database.
 *
 * ## Why the migration is required at all
 *
 * `ensureCommercePlan` (`packages/seed/src/required/commercePlan.seed.ts`)
 * INSERTS ONLY — an existing plan row is skipped wholesale, its `entitlements`
 * and `limits` columns untouched. Editing `plans.config.ts` therefore reaches a
 * fresh `db:fresh` and nothing else; staging and production keep what they were
 * seeded with until this runs.
 *
 * ## THE HALF THAT IS NOT LIKE 0084
 *
 * `0084` and its siblings grant an entitlement and stop. This one MUST also
 * write the LIMIT, and the two halves fail in opposite directions:
 *
 * - The **entitlement** half fails CLOSED. `AI_CHAT` is absent from
 *   `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` (the code floor every tier
 *   receives) because it is a tier differentiator — putting it there would
 *   hand the chat to `-basico` and `-pro`. So until this migration runs, a
 *   premium subscriber is REFUSED the chat. Safe, and self-correcting.
 *
 * - The **limit** half fails OPEN, and that is why it cannot be skipped. A
 *   `LimitKey` the plan row does not declare is resolved as UNLIMITED by the
 *   layers beneath — `commerce-limits.config.ts` opens with that warning. Ship
 *   the entitlement without the cap and the first premium commerce subscriber
 *   gets an uncapped AI bill.
 *
 * `resolveCommerceVerticalGrants` has a belt for exactly that case (an
 * `aiChatCap` of 0 when the row grants `AI_CHAT` but declares no quota, plus a
 * warning log). This migration is the braces: it makes the belt unnecessary
 * rather than load-bearing.
 *
 * ## Both verticals, unlike 0084
 *
 * A chat is a page feature and every listing has a page, so both
 * `gastronomy-premium` and `experience-premium` receive the grant — the same
 * reasoning `0080` (the printable ficha) applied, and the opposite of `0084`
 * (a dish photo, which an experience has nowhere to hang).
 *
 * The CAP, unlike the grant, goes on ALL SIX rows including `-basico` and
 * `-pro`. A tier without the entitlement is already refused by the gate, so the
 * zero is redundant there — until somebody moves the key between tiers, at
 * which point a row with a grant and no cap is exactly the uncapped-bill case
 * above. Writing all six is what makes the invariant "every commerce plan row
 * declares its chat cap" true rather than mostly true.
 *
 * ## No new `billing_entitlements` lookup row
 *
 * `ai_chat` already exists — the accommodation catalogue has granted it since
 * SPEC-173, so the lookup row was seeded long ago. This migration only unions
 * the key into two plan rows. It re-checks anyway and inserts if absent, so a
 * database seeded from a narrower baseline is not left with a dangling grant.
 *
 * ## No column dependency, hence no `meta.requiresColumns`
 *
 * HOS-400's PR 1 ships no structural migration. This one touches
 * `billing_entitlements` and `billing_plans` only, both long-existing.
 *
 * ## Idempotency
 *
 * - Lookup row: inserted only when absent.
 * - Grant: the `entitlements` array is rewritten to the UNION of what the row
 *   holds and `ai_chat`, guarded on the row not already containing it.
 * - Cap: written only when the row's `limits` object does not already carry the
 *   key. An operator who RAISED the cap through the admin editor keeps their
 *   value — the cap is a `'commercial'` field, so the database wins.
 *
 * A re-run affects zero rows.
 *
 * ## `destructive` flag decision
 *
 * `false`. One conditional lookup insert, one additive array union, and one
 * additive object key. Nothing is deleted, and no existing key of either JSON
 * column is rewritten to a narrower value — the unions read back and preserve
 * whatever `0077`, `0080`, `0081`, `0082`, `0084`, `0085`, `0086`, `0087` and
 * `0088` granted.
 */
import { billingEntitlements, billingPlans, eq } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0093-hos-400-commerce-ai-chat-grant-and-quota',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The entitlement key, spelled as a literal.
 *
 * Literal rather than a lookup into `ENTITLEMENT_DEFINITIONS`: a migration
 * records the delta it applied on the day it ran, and must keep describing that
 * delta even after a later baseline change edits the array underneath it.
 */
const AI_CHAT_ENTITLEMENT = {
    key: 'ai_chat',
    name: 'AI chat',
    description:
        'Allows visitors to ask an AI assistant questions about the listing, answered from the data its owner published'
} as const;

/** The two rows that receive the GRANT. Premium only, in both verticals. */
const GRANTED_PLAN_NAMES = ['gastronomy-premium', 'experience-premium'] as const;

/**
 * The chat cap every commerce plan row must declare, by plan slug.
 *
 * Six entries, including the four that grant nothing: see the fileoverview for
 * why a zero on a tier without the entitlement is not redundant. `1250` is the
 * accommodation premium rung (owner decision, 2026-09-03) and matches
 * `COMMERCE_AI_CHAT_PER_MONTH` in `plans.config.ts`; the literal is repeated
 * here rather than imported, for the same reason the entitlement key is.
 */
const AI_CHAT_CAP_BY_PLAN_NAME: Readonly<Record<string, { key: string; value: number }>> = {
    'gastronomy-basico': { key: 'max_ai_chat_gastronomy_per_month', value: 0 },
    'gastronomy-pro': { key: 'max_ai_chat_gastronomy_per_month', value: 0 },
    'gastronomy-premium': { key: 'max_ai_chat_gastronomy_per_month', value: 1250 },
    'experience-basico': { key: 'max_ai_chat_experience_per_month', value: 0 },
    'experience-pro': { key: 'max_ai_chat_experience_per_month', value: 0 },
    'experience-premium': { key: 'max_ai_chat_experience_per_month', value: 1250 }
};

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let entitlementsCreated = 0;
    let plansGranted = 0;
    let capsWritten = 0;

    // ── 1. The `billing_entitlements` lookup row (normally already present) ──
    const existing = await ctx.db
        .select({ id: billingEntitlements.id })
        .from(billingEntitlements)
        .where(eq(billingEntitlements.key, AI_CHAT_ENTITLEMENT.key))
        .limit(1);

    if (existing.length === 0) {
        await ctx.db.insert(billingEntitlements).values({
            key: AI_CHAT_ENTITLEMENT.key,
            name: AI_CHAT_ENTITLEMENT.name,
            description: AI_CHAT_ENTITLEMENT.description
        });
        entitlementsCreated += 1;
    }

    // ── 2. Grant + cap, per commerce plan row ───────────────────────────────
    // Read first rather than issuing a blind UPDATE: both columns are JSON and
    // each delta has to be computed against whatever the row actually holds —
    // the keys earlier migrations granted, plus anything an operator added
    // through the SPEC-168 admin editor.
    for (const [planName, cap] of Object.entries(AI_CHAT_CAP_BY_PLAN_NAME)) {
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

            const needsGrant =
                (GRANTED_PLAN_NAMES as readonly string[]).includes(planName) &&
                !currentEntitlements.includes(AI_CHAT_ENTITLEMENT.key);
            // An operator who already set a cap keeps it: the limit is a
            // 'commercial' field, so the database wins over the config.
            const needsCap = !(cap.key in currentLimits);

            if (!needsGrant && !needsCap) {
                continue;
            }

            await ctx.db
                .update(billingPlans)
                .set({
                    ...(needsGrant
                        ? {
                              entitlements: [...currentEntitlements, AI_CHAT_ENTITLEMENT.key]
                          }
                        : {}),
                    ...(needsCap ? { limits: { ...currentLimits, [cap.key]: cap.value } } : {}),
                    updatedAt: new Date()
                })
                .where(eq(billingPlans.id, row.id));

            if (needsGrant) {
                plansGranted += 1;
            }
            if (needsCap) {
                capsWritten += 1;
            }
        }
    }

    const counts = { entitlementsCreated, plansGranted, capsWritten };
    const changed = entitlementsCreated + plansGranted + capsWritten > 0;

    const summary = changed
        ? `HOS-400: created ${entitlementsCreated} billing_entitlements row(s), granted ai_chat on ${plansGranted} commerce premium plan row(s) and wrote ${capsWritten} chat cap(s).`
        : 'HOS-400: ai_chat already granted and capped on every commerce plan row — no change.';

    return { summary, counts };
}
