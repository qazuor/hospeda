/**
 * @file plan-card-delta.ts
 * @description Computes the CUMULATIVE DELTA between two consecutive pricing
 * tiers (HOS-943, H2 of the HOS-941 epic).
 *
 * From the second tier onwards a pricing card reads "everything in <previous>,
 * plus:" and then lists ONLY what that tier adds. This module is the thing that
 * decides what "adds" means, and it is deliberately a pure function over the
 * plan payloads the public API already returns — never a hand-curated list in
 * the component or in the locale files. A curated delta desynchronises the
 * first time an operator edits a plan in admin, and nothing would report it.
 *
 * ## Why entitlements alone are not the delta
 *
 * The obvious implementation compares `plan.entitlements` and stops there. It
 * is wrong, and it fails silently in the worst possible way. Several tiers in
 * this catalogue differ ONLY in their numeric `limits`: `owner-basico` and
 * `owner-pro` both grant `publish_accommodations`, but one publishes 1
 * accommodation with 15 photos and the other 3 with 30. A boolean-only diff
 * renders "Everything in Basic, plus:" followed by NOTHING — a card that
 * advertises an upgrade while showing no reason to buy it.
 *
 * So a delta has two halves, and a rise in a numeric cap is a first-class item
 * with its own line, exactly like a newly granted entitlement.
 *
 * ## What counts as a rise
 *
 * `-1` is the catalogue's unlimited sentinel, so it ranks ABOVE every finite
 * value rather than below zero (`limitRank`). A key absent from the previous
 * tier and present here is `introduced`; a key whose rank grew is `raised`.
 * A limit that DROPS is omitted from the delta: it exists (the owner AI ladder
 * has re-cut chat quotas downward before) but "everything in X, plus: fewer
 * chats" is not a plus, and the comparison table is the surface that shows
 * every value side by side.
 */

import { LimitKey } from '@repo/billing';

/**
 * The catalogue's "no cap" sentinel. Stored as `-1` in `billing_plans.limits`
 * and in `plans.config.ts`; ranked as `+Infinity` when comparing tiers.
 */
export const UNLIMITED_LIMIT_VALUE = -1;

/**
 * Display order for limit lines, most commercially meaningful first.
 *
 * This is presentation order only — it can never change WHICH limits appear
 * (that is decided by the plan payloads) and a key missing from this list is
 * appended in payload order rather than dropped. Deriving the order from
 * `plan-comparison-rows.ts` was considered and rejected: those groups lead with
 * the inherited tourist rows, which would put "favourites" above "published
 * accommodations" on an owner card.
 */
export const LIMIT_DISPLAY_ORDER: readonly string[] = [
    LimitKey.MAX_ACCOMMODATIONS,
    LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
    LimitKey.MAX_ACTIVE_PROMOTIONS,
    LimitKey.MAX_PROPERTIES,
    LimitKey.MAX_STAFF_ACCOUNTS,
    LimitKey.MAX_GASTRONOMIES,
    LimitKey.MAX_EXPERIENCES,
    LimitKey.MAX_FAVORITES,
    LimitKey.MAX_COLLECTIONS,
    LimitKey.MAX_SEARCH_HISTORY_ENTRIES,
    LimitKey.MAX_COMPARE_ITEMS,
    LimitKey.MAX_ACTIVE_ALERTS,
    LimitKey.MAX_AI_TEXT_IMPROVE_PER_MONTH,
    LimitKey.MAX_AI_TRANSLATE_PER_MONTH,
    LimitKey.MAX_AI_ACCOMMODATION_IMPORT_PER_MONTH,
    LimitKey.MAX_AI_CHAT_PER_MONTH,
    LimitKey.MAX_AI_SEARCH_PER_MONTH,
    LimitKey.MAX_AI_CHAT_CONSUMER_PER_MONTH,
    LimitKey.MAX_AI_SUPPORT_PER_MONTH
];

/**
 * Minimal plan shape the delta needs. Structurally satisfied by
 * `PublicPlanData` (the runtime endpoint payload), so tests can build fixtures
 * without the full API response.
 */
export interface PlanDeltaSource {
    readonly slug: string;
    /** Entitlement keys the plan grants, as plain strings. */
    readonly entitlements: readonly string[];
    /** Limits as a key -> numeric-value map (QZPay storage format). */
    readonly limits: Readonly<Record<string, number>>;
}

/** Whether a limit line exists because it is new, or because its cap grew. */
export type PlanLimitChangeKind = 'introduced' | 'raised';

/** One numeric cap the tier introduces or raises. */
export interface PlanLimitChange {
    readonly key: string;
    readonly value: number;
    /** The previous tier's value, or `null` on the first tier / a new key. */
    readonly previousValue: number | null;
    readonly kind: PlanLimitChangeKind;
    /** True when `value` is the unlimited sentinel. */
    readonly isUnlimited: boolean;
}

/** Everything one card needs to render its own bullet list. */
export interface PlanDelta {
    readonly slug: string;
    /** True for the tier that has no predecessor — it lists everything. */
    readonly isFirstTier: boolean;
    /**
     * Slug of the tier this one builds on, or `null` on the first tier.
     *
     * The template gates the "everything in <previous>, plus:" header on this
     * being non-null. That is the whole defence against rendering "everything
     * in plan undefined, plus:" on a single-tier audience (AC-17).
     */
    readonly previousSlug: string | null;
    /** Entitlements this tier grants that the previous one did not. */
    readonly addedEntitlements: readonly string[];
    /** Numeric caps this tier introduces or raises, in display order. */
    readonly limitChanges: readonly PlanLimitChange[];
    /** True when the tier adds neither an entitlement nor a cap. */
    readonly isEmpty: boolean;
}

/**
 * Rank a raw limit value so tiers can be compared.
 *
 * The unlimited sentinel (`-1`) is the TOP of the scale, not the bottom: a
 * naive numeric comparison would read `owner-premium`'s unlimited promotions
 * as a downgrade from `owner-pro`'s 5 and drop it from the delta.
 *
 * @param value - Raw value from the plan's `limits` map.
 * @returns A comparable rank, `+Infinity` for unlimited.
 */
function limitRank(value: number): number {
    return value === UNLIMITED_LIMIT_VALUE ? Number.POSITIVE_INFINITY : value;
}

/**
 * Whether a raw limits-map entry is a usable numeric cap.
 *
 * Rejects `NaN`, `Infinity` and non-numbers so a malformed payload produces a
 * shorter list rather than a `NaN` rendered on a public pricing card.
 */
function isUsableLimit(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Order limit keys for display: curated keys first in
 * {@link LIMIT_DISPLAY_ORDER}, everything else appended in payload order.
 */
function sortLimitKeys(keys: readonly string[]): readonly string[] {
    const rank = new Map<string, number>(LIMIT_DISPLAY_ORDER.map((key, i) => [key, i]));
    return keys
        .map((key, index) => ({ key, index }))
        .sort((a, b) => {
            const rankA = rank.get(a.key) ?? Number.POSITIVE_INFINITY;
            const rankB = rank.get(b.key) ?? Number.POSITIVE_INFINITY;
            if (rankA !== rankB) return rankA - rankB;
            return a.index - b.index;
        })
        .map((entry) => entry.key);
}

/**
 * Compute what one tier adds on top of the tier below it.
 *
 * @param params.plan - The tier being rendered.
 * @param params.previous - The tier immediately below it in `sortOrder`, or
 *   `undefined` when this is the first (or only) tier of the audience. On the
 *   first tier the "delta" is the plan's ENTIRE offer: every entitlement and
 *   every cap, each reported as `introduced` with a `null` previous value.
 * @returns The delta for this card.
 */
export function computePlanDelta({
    plan,
    previous
}: {
    readonly plan: PlanDeltaSource;
    readonly previous?: PlanDeltaSource | undefined;
}): PlanDelta {
    const limitKeys = sortLimitKeys(
        Object.keys(plan.limits).filter((key) => isUsableLimit(plan.limits[key]))
    );

    if (!previous) {
        const limitChanges: PlanLimitChange[] = limitKeys.map((key) => {
            const value = plan.limits[key] as number;
            return {
                key,
                value,
                previousValue: null,
                kind: 'introduced',
                isUnlimited: value === UNLIMITED_LIMIT_VALUE
            };
        });
        return {
            slug: plan.slug,
            isFirstTier: true,
            previousSlug: null,
            addedEntitlements: [...plan.entitlements],
            limitChanges,
            isEmpty: plan.entitlements.length === 0 && limitChanges.length === 0
        };
    }

    const previousEntitlements = new Set<string>(previous.entitlements);
    const addedEntitlements = plan.entitlements.filter((key) => !previousEntitlements.has(key));

    const limitChanges: PlanLimitChange[] = [];
    for (const key of limitKeys) {
        const value = plan.limits[key] as number;
        const rawPrevious = previous.limits[key];
        if (!isUsableLimit(rawPrevious)) {
            limitChanges.push({
                key,
                value,
                previousValue: null,
                kind: 'introduced',
                isUnlimited: value === UNLIMITED_LIMIT_VALUE
            });
            continue;
        }
        if (limitRank(value) > limitRank(rawPrevious)) {
            limitChanges.push({
                key,
                value,
                previousValue: rawPrevious,
                kind: 'raised',
                isUnlimited: value === UNLIMITED_LIMIT_VALUE
            });
        }
    }

    return {
        slug: plan.slug,
        isFirstTier: false,
        previousSlug: previous.slug,
        addedEntitlements,
        limitChanges,
        isEmpty: addedEntitlements.length === 0 && limitChanges.length === 0
    };
}

/**
 * Compute the delta of every tier in a rendered grid, in one pass.
 *
 * @param params.plans - The tiers actually rendered, already ordered by
 *   `sortOrder` (which is what `filterPlansByCategory` returns). Element `i`
 *   is diffed against element `i - 1`; element `0` has no predecessor.
 * @returns One delta per plan, positionally aligned with `plans`.
 */
export function computePlanDeltas({
    plans
}: {
    readonly plans: readonly PlanDeltaSource[];
}): readonly PlanDelta[] {
    return plans.map((plan, index) =>
        computePlanDelta({ plan, previous: index > 0 ? plans[index - 1] : undefined })
    );
}
