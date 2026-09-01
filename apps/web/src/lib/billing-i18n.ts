/**
 * @file billing-i18n.ts
 * @description Locale-aware lookups for billing config values that the billing
 * package stores in English. The billing package is the single source of truth
 * for plans, entitlements and limits, but its strings are config-language only
 * (per packages/billing/CLAUDE.md). This module wraps each lookup with i18n
 * keys that translators can override per locale; falls back to the config value
 * when no translation is provided.
 */

import type { LimitKey } from '@repo/billing';
import {
    ENTITLEMENT_DEFINITIONS as DEFINITIONS,
    EntitlementKey as EK,
    LIMIT_METADATA,
    TOURIST_VIP_ENTITLEMENTS
} from '@repo/billing';

export type EntitlementKey = (typeof DEFINITIONS)[number]['key'];
type Translator = (key: string, fallback?: string) => string;

/** Audience for a pricing surface — drives owner-only display grouping. */
export type PricingAudience = 'owner' | 'tourist';

/** A renderable feature bullet: either a single entitlement or a collapsed group. */
export interface DisplayFeature {
    readonly id: string;
    readonly label: string;
}

/**
 * Owner-specific AI entitlements collapsed into one "AI suite" bullet on owner
 * cards. Defined here (no grouping metadata exists on the entitlement config)
 * but anchored to the real `EntitlementKey` enum so it can't drift from the keys.
 */
const AI_OWNER_ENTITLEMENTS: readonly string[] = [
    EK.AI_TEXT_IMPROVE,
    EK.AI_CHAT,
    EK.AI_TRANSLATE,
    EK.AI_ACCOMMODATION_IMPORT
];

/**
 * Minimal plan shape required by i18n helpers. Accepts both the static
 * `PlanDefinition` from @repo/billing and the runtime `PublicPlanData` from
 * @/lib/billing/fetch-plans — both provide slug, name, and description.
 */
interface PlanLike {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
}

const ENTITLEMENT_BY_KEY: Map<string, (typeof DEFINITIONS)[number]> = new Map(
    DEFINITIONS.map((def) => [def.key as string, def])
);

/**
 * Get the localized human-readable name for a plan.
 *
 * Tries `billing.plan.<slug>.name`. Falls back to the English `plan.name` from
 * the billing config so missing translations never produce an empty card.
 */
export function getPlanName(input: { plan: PlanLike; t: Translator }): string {
    const { plan, t } = input;
    return t(`billing.plan.${plan.slug}.name`, plan.name);
}

/**
 * Get the localized description for a plan.
 *
 * Tries `billing.plan.<slug>.description`. Falls back to the English
 * description from the billing config.
 */
export function getPlanDescription(input: { plan: PlanLike; t: Translator }): string {
    const { plan, t } = input;
    return t(`billing.plan.${plan.slug}.description`, plan.description);
}

/**
 * Get the localized name for an entitlement key.
 *
 * Tries `billing.entitlement.<key>`. Falls back to the English name from the
 * entitlement definition; if the key is unknown, falls back to the raw key
 * (formatted) so the UI never renders an empty bullet.
 */
export function getEntitlementName(input: { key: EntitlementKey; t: Translator }): string {
    const { key, t } = input;
    const def = ENTITLEMENT_BY_KEY.get(key as string);
    const fallback = def?.name ?? humanizeKey(key as string);
    return t(`billing.entitlement.${key}`, fallback);
}

/**
 * Turn a plan's raw entitlement keys into the bullets shown on a pricing card.
 *
 * For the tourist audience this is a 1:1 mapping (each entitlement is a bullet).
 * For the owner audience the list is curated to stay short (SPEC-299): the full
 * inherited tourist tier collapses into a single "all tourist features" bullet,
 * and the owner AI entitlements collapse into one "AI suite" bullet. Owner-core
 * entitlements (publish, stats, calendar, …) stay individual. Groups are emitted
 * at the position of their first member, preserving the original ordering.
 *
 * Nothing is hidden — collapsed groups still communicate their contents via the
 * group label; they just don't enumerate every sub-feature.
 */
export function getDisplayFeatures(input: {
    keys: readonly string[];
    audience: PricingAudience;
    t: Translator;
}): DisplayFeature[] {
    const { keys, audience, t } = input;
    if (audience !== 'owner') {
        return keys.map((k) => ({
            id: k,
            label: getEntitlementName({ key: k as EntitlementKey, t })
        }));
    }

    const touristSet = new Set<string>(TOURIST_VIP_ENTITLEMENTS as readonly string[]);
    const aiSet = new Set<string>(AI_OWNER_ENTITLEMENTS);
    // Only collapse the tourist tier when the plan actually grants all of it.
    const hasFullTouristTier = [...touristSet].every((k) => keys.includes(k));

    const out: DisplayFeature[] = [];
    let touristEmitted = false;
    let aiEmitted = false;
    for (const key of keys) {
        if (hasFullTouristTier && touristSet.has(key)) {
            if (!touristEmitted) {
                out.push({
                    id: 'group-tourist',
                    label: t('pricing.group.tourist', 'Todas las funciones de turista')
                });
                touristEmitted = true;
            }
            continue;
        }
        if (aiSet.has(key)) {
            if (!aiEmitted) {
                out.push({
                    id: 'group-ai',
                    label: t(
                        'pricing.group.ai',
                        'Suite de IA: textos, traducción, importación y consultas'
                    )
                });
                aiEmitted = true;
            }
            continue;
        }
        out.push({ id: key, label: getEntitlementName({ key: key as EntitlementKey, t }) });
    }
    return out;
}

/**
 * Get the localized name for a limit key.
 *
 * Tries `billing.comparison.limitLabel.<key>`. Falls back to the English name
 * from `LIMIT_METADATA`; if the key is unknown, falls back to the raw key
 * (formatted) so the UI never renders an empty row label.
 */
export function getLimitName(input: { key: string; t: Translator }): string {
    const { key, t } = input;
    const meta = LIMIT_METADATA[key as LimitKey];
    const fallback = meta?.name ?? humanizeKey(key);
    return t(`billing.comparison.limitLabel.${key}`, fallback);
}

/**
 * Get the plain-language explanation of what a numeric limit means, and what
 * happens once it is reached (HOS-943 AC-13).
 *
 * A pricing card that says "15 photos" and nothing else asks the reader to
 * guess: per listing or in total? blocked at the cap or charged for more?
 * `billing.limitHelp.<key>` answers both, and every limit key in the catalogue
 * has one.
 *
 * Falls back to `LIMIT_METADATA`'s English description rather than to an empty
 * string on purpose: the explanation is the accessible name the value hangs
 * off, so an unexplained number is the one output this must never produce.
 */
export function getLimitHelp(input: { key: string; t: Translator }): string {
    const { key, t } = input;
    const meta = LIMIT_METADATA[key as LimitKey];
    const fallback = meta?.description ?? humanizeKey(key);
    return t(`billing.limitHelp.${key}`, fallback);
}

/**
 * Render a limit's numeric value for display: either the localized "unlimited"
 * label or the number formatted for the locale.
 *
 * @param input.value - Raw value from the plan's `limits` map.
 * @param input.isUnlimited - Whether the value is the catalogue's `-1`
 *   sentinel. Passed in rather than re-derived so this helper stays ignorant of
 *   the sentinel's spelling — `plan-card-delta.ts` owns that.
 * @param input.intlLocale - BCP-47 tag for thousand separators.
 */
export function formatLimitValue(input: {
    value: number;
    isUnlimited: boolean;
    intlLocale: string;
    t: Translator;
}): string {
    const { value, isUnlimited, intlLocale, t } = input;
    if (isUnlimited) return t('billing.comparison.unlimited', 'Ilimitado');
    try {
        return new Intl.NumberFormat(intlLocale).format(value);
    } catch {
        return String(value);
    }
}

/**
 * Get the "Recommended for: <profile>" copy of a plan.
 *
 * Every plan gets a profile — that is the point (HOS-943 AC-12). Rather than
 * one plan wearing a "most popular" badge, which needs data Hospeda does not
 * have and turns the other two tiers into losers, each card names the person it
 * is for and lets the reader self-select.
 *
 * The per-slug key is curated copy; a slug nobody has written copy for yet
 * degrades to the audience's generic profile rather than to a raw dotted key,
 * so a plan added in admin can never render a card with no profile line.
 */
export function getPlanRecommendedFor(input: {
    plan: PlanLike;
    audience: PricingAudience;
    t: Translator;
}): string {
    const { plan, audience, t } = input;
    const generic = t(`pricing.recommendedFor.default.${audience}`);
    return t(`pricing.recommendedFor.plan.${plan.slug}`, generic);
}

/**
 * Get the localized label for an entitlement-or-limit group header in the
 * comparison table.
 */
export function getComparisonGroupLabel(input: { group: string; t: Translator }): string {
    const { group, t } = input;
    return t(`billing.comparison.group.${group}`, humanizeKey(group));
}

function humanizeKey(key: string): string {
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
