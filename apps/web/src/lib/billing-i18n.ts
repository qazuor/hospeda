/**
 * @file billing-i18n.ts
 * @description Locale-aware lookups for billing config values that the billing
 * package stores in English. The billing package is the single source of truth
 * for plans, entitlements and limits, but its strings are config-language only
 * (per packages/billing/CLAUDE.md). This module wraps each lookup with i18n
 * keys that translators can override per locale; falls back to the config value
 * when no translation is provided.
 */

import { ENTITLEMENT_DEFINITIONS as DEFINITIONS } from '@repo/billing';

export type EntitlementKey = (typeof DEFINITIONS)[number]['key'];
type Translator = (key: string, fallback?: string) => string;

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

function humanizeKey(key: string): string {
    return key
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}
