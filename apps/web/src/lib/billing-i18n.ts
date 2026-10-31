/**
 * @file billing-i18n.ts
 * @description Locale-aware lookups for billing config values that the billing
 * catalog stores in English. The plan catalog is the source of truth
 * for plans, entitlements and limits, but its strings are config-language only
 * (config values are not localised at the source). This module wraps each lookup with i18n
 * keys that translators can override per locale; falls back to the config value
 * when no translation is provided.
 */

import { EntitlementKeyEnum as EK } from '@repo/schemas';

export { getPlanName } from './billing/plan-name';

export type EntitlementKey = EK;
type Translator = (key: string, fallback?: string) => string;

/**
 * Audience for a pricing surface — drives owner-only display grouping.
 *
 * FIVE values since HOS-1032, one per audience Hospeda sells to, because
 * `/planes/<audiencia>/precios/` renders all five through the same
 * `PricingCardsGrid` (AC-44). The three added here are the venue/experience verticals
 * and partner; they never take the owner branch of {@link getDisplayFeatures},
 * so widening the type changed no existing behaviour.
 *
 * `owner` (not `host`) and `venue` (not `gastronomia`) are the PLAN
 * vocabulary — the `category` and `product_domain` columns — deliberately kept
 * apart from the Spanish URL segments. `AudienceCardId` in
 * `billing/audience-plans.ts` is the third vocabulary, spelled `host`; the
 * translation between the two lives in `PRICING_AUDIENCE_BY_CARD_ID` there and
 * nowhere else.
 */
export type PricingAudience = 'owner' | 'tourist' | 'venue' | 'experience' | 'partner';

/** A renderable feature bullet: either a single entitlement or a collapsed group. */
export interface DisplayFeature {
    readonly id: string;
    readonly label: string;
}

/**
 * Owner-specific AI entitlements collapsed into one "AI suite" bullet on owner
 * cards. Defined here (no grouping metadata exists on the entitlement config)
 * but anchored to the real `EntitlementKeyEnum` enum so it can't drift from the keys.
 */
const AI_OWNER_ENTITLEMENTS: readonly string[] = [
    EK.AI_TEXT_IMPROVE,
    EK.AI_CHAT,
    EK.AI_TRANSLATE,
    EK.AI_ACCOMMODATION_IMPORT
];

interface PlanLike {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
}

/**
 * Get the localized description for a plan.
 *
 * Tries `billing.plan.<slug>.description`. Falls back to the English
 * description from the plan catalog.
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
export function getEntitlementName(input: {
    key: EntitlementKey;
    t: Translator;
    audience?: PricingAudience;
}): string {
    const { key, t, audience } = input;
    // HOS-1352: transitional until V2 (HOS-1356), see PR: locale labels replace the demolished plan-definition fallback.
    const generic = t(`billing.entitlement.${key}`, humanizeKey(key));
    if (audience === undefined) return generic;
    // HOS-1799: one key can mean different things per audience (`ai_chat` is the
    // visitor's chat about a stay for tourists, the listing owner's chat for
    // venue/experience). An audience override, when the locale has one, wins;
    // otherwise the generic label stands.
    return t(`billing.entitlementByAudience.${audience}.${key}`, generic);
}

/**
 * Turn a plan's raw entitlement keys into the bullets shown on a pricing card.
 *
 * For the tourist audience this is a 1:1 mapping (each entitlement is a bullet).
 * For the owner audience, AI entitlements collapse into one "AI suite" bullet.
 * Owner-core entitlements (publish, stats, calendar, …) stay individual. The
 * inherited Tourist VIP group is assembled from catalog keys in
 * `pricing-card-view.ts`. Groups are emitted
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
            label: getEntitlementName({ key: k as EntitlementKey, t, audience })
        }));
    }

    const aiSet = new Set<string>(AI_OWNER_ENTITLEMENTS);

    const out: DisplayFeature[] = [];
    let aiEmitted = false;
    for (const key of keys) {
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
        out.push({
            id: key,
            label: getEntitlementName({ key: key as EntitlementKey, t, audience })
        });
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
    // HOS-1352: transitional until V2 (HOS-1356), see PR: locale labels replace the demolished limit metadata fallback.
    return t(`billing.comparison.limitLabel.${key}`, humanizeKey(key));
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
 * Falls back to a readable generic explanation until localized copy is
 * restored; an unexplained number must never be rendered.
 */
export function getLimitHelp(input: { key: string; t: Translator }): string {
    const { key, t } = input;
    // HOS-1352: transitional until V2 (HOS-1356), see PR: localized limit explanations replace this generic fallback.
    return t(
        `billing.limitHelp.${key}`,
        `Allowed maximum for ${humanizeKey(key).replace(/^Max /, '')}.`
    );
}

/**
 * Render a limit's numeric value for display: either the localized "unlimited"
 * label or the number formatted for the locale.
 *
 * @param input.value - Raw value from the plan's `limits` map.
 * @param input.isUnlimited - Whether the value is the catalogue's int4 max
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
