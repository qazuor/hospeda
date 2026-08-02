/**
 * @file plan-usage-config.ts
 * @description Presentation rules for the plan-usage section: which audience a
 * limit belongs to, which add-on raises it, and what order the rows go in.
 *
 * Kept out of the island so the grouping logic can be unit-tested without
 * rendering, and so adding a limit is a one-line change in a table rather than
 * an edit inside JSX.
 *
 * The API decides what a limit MEANS (`usageKind`, `isMeasured`); this file
 * decides how it is PRESENTED. Do not move `usageKind` here — a consumer must
 * never re-derive whether a number is real.
 */

import type { LimitUsage } from '@/lib/api/endpoints-protected';

/**
 * Which side of the product a limit belongs to.
 *
 * A single user can be both: someone who rents out a cabin and also saves
 * favourites as a traveller. Grouping this way keeps each block under one
 * coherent upgrade path (host plans vs tourist plans).
 */
export type UsageAudience = 'host' | 'traveler';

/**
 * Audience of every limit key.
 *
 * The AI meters are split by what they serve rather than kept together:
 * improving a listing's text is host work, asking the assistant about a place
 * is traveller work.
 */
const AUDIENCE_BY_LIMIT_KEY: Readonly<Record<string, UsageAudience>> = {
    // ── Host ──────────────────────────────────────────────────────────────
    max_accommodations: 'host',
    max_photos_per_accommodation: 'host',
    max_active_promotions: 'host',
    max_properties: 'host',
    max_staff_accounts: 'host',
    max_ai_text_improve_per_month: 'host',
    max_ai_chat_per_month: 'host',
    max_ai_translate_per_month: 'host',
    max_ai_accommodation_import_per_month: 'host',
    max_ai_support_per_month: 'host',
    // ── Traveler ──────────────────────────────────────────────────────────
    max_favorites: 'traveler',
    max_collections: 'traveler',
    max_active_alerts: 'traveler',
    max_compare_items: 'traveler',
    max_search_history_entries: 'traveler',
    max_ai_search_per_month: 'traveler',
    max_ai_chat_consumer_per_month: 'traveler'
};

/**
 * Add-on slug that raises a given limit, for the add-ons that are actually
 * purchasable today.
 *
 * Deliberately NOT the full `affectsLimitKey` mapping from
 * `@repo/billing`'s addon config: `extra-properties-5` raises a limit whose
 * feature does not exist, and `ai-support-monthly` ships `isActive: false`.
 * Linking to either would send the user to a card that is not on the page.
 */
const ADDON_SLUG_BY_LIMIT_KEY: Readonly<Record<string, string>> = {
    max_accommodations: 'extra-accommodations-5',
    max_photos_per_accommodation: 'extra-photos-20'
};

/**
 * Display order within an audience group: the things you hold, then what you
 * consume monthly, then plain caps. Keeps the rows with progress bars together
 * at the top instead of interleaved with cap-only rows.
 */
const KIND_ORDER: Readonly<Record<string, number>> = {
    stock: 0,
    per_accommodation: 1,
    monthly: 2,
    per_operation: 3,
    unbuilt: 4
};

/**
 * Returns the audience a limit belongs to.
 *
 * Unknown keys fall back to `host`: a new limit is far more likely to be a
 * host capability, and the host block is the one an affected user is already
 * looking at.
 *
 * @param limitKey - The limit key.
 * @returns Its audience.
 */
export function audienceForLimit(limitKey: string): UsageAudience {
    return AUDIENCE_BY_LIMIT_KEY[limitKey] ?? 'host';
}

/**
 * Returns the add-on slug that raises this limit, when one is purchasable.
 *
 * @param limitKey - The limit key.
 * @returns The add-on slug, or `undefined` when no purchasable add-on applies.
 */
export function addonSlugForLimit(limitKey: string): string | undefined {
    return ADDON_SLUG_BY_LIMIT_KEY[limitKey];
}

/**
 * Whether a limit should appear at all.
 *
 * Two exclusions, for different reasons:
 * - `maxAllowed === 0` — the plan does not grant it. The endpoint returns
 *   every `LimitKey`, so without this the user sees rows for features they
 *   do not have.
 * - `usageKind === 'unbuilt'` — the plan grants it but the feature does not
 *   exist in the app. Advertising it sends the user looking for something
 *   that is not there.
 *
 * Note `maxAllowed === -1` (unlimited) IS shown — an unlimited grant is worth
 * knowing about.
 *
 * @param limit - The limit to test.
 * @returns `true` when the row belongs on the page.
 */
export function shouldDisplayLimit(limit: LimitUsage): boolean {
    return limit.maxAllowed !== 0 && limit.usageKind !== 'unbuilt';
}

/**
 * Fraction of a cap at which a row starts offering a way to raise it.
 *
 * Matches the server's `warning` threshold so a per-accommodation row (whose
 * threshold is computed here, not server-side) prompts at the same point as
 * every account-wide row.
 */
const UPGRADE_PROMPT_RATIO = 0.8;

/**
 * Whether a limit is close enough to its ceiling to be worth acting on.
 *
 * Drives whether the upgrade / add-on links are offered on that row: showing
 * them on every row turns the whole section into an ad, showing them on none
 * leaves a user at their cap with no way forward.
 *
 * A `per_accommodation` limit needs its own answer. The server's threshold for
 * it is computed from an account-wide `currentUsage` that is structurally 0,
 * so it always reads `ok` — an owner with 25 of 15 photos on a listing would
 * be shown no way out, which is exactly the case the photo add-on exists for.
 * The verdict there comes from the fullest accommodation.
 *
 * Unlimited (`-1`) never qualifies — there is nothing to run out of.
 *
 * @param limit - The limit to test.
 * @returns `true` when the row should offer a way to raise the limit.
 */
export function needsUpgradePrompt(limit: LimitUsage): boolean {
    if (limit.maxAllowed === -1) {
        return false;
    }

    if (limit.usageKind === 'per_accommodation') {
        const worst = (limit.perAccommodation ?? []).reduce(
            (max, entry) => Math.max(max, entry.currentUsage),
            0
        );

        return limit.maxAllowed > 0 && worst / limit.maxAllowed >= UPGRADE_PROMPT_RATIO;
    }

    return limit.threshold !== 'ok';
}

/** One audience group of limits, ready to render. */
export interface UsageGroup {
    readonly audience: UsageAudience;
    readonly limits: readonly LimitUsage[];
}

/**
 * Splits the displayable limits into audience groups, each internally sorted.
 *
 * Empty groups are dropped, so a user who is only a traveller never sees an
 * empty "as a host" heading.
 *
 * @param limits - Every limit as returned by the usage endpoint.
 * @returns Non-empty groups in host-then-traveler order.
 */
export function groupLimitsByAudience(limits: readonly LimitUsage[]): readonly UsageGroup[] {
    const visible = limits.filter(shouldDisplayLimit);

    const order: readonly UsageAudience[] = ['host', 'traveler'];

    return order
        .map((audience) => ({
            audience,
            limits: visible
                .filter((limit) => audienceForLimit(limit.limitKey) === audience)
                .slice()
                .sort((a, b) => (KIND_ORDER[a.usageKind] ?? 99) - (KIND_ORDER[b.usageKind] ?? 99))
        }))
        .filter((group) => group.limits.length > 0);
}
