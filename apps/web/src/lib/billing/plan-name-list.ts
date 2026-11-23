/**
 * @file billing/plan-name-list.ts
 * @description Client-safe helpers that turn catalog plan names (read on the SSR page by
 * `planNamesWithEntitlement`) into the copy of a plan gate. HOS-2544: a gate never names a
 * plan by hand, so these helpers only ever format names the catalog supplied.
 */

import type { TranslationFn } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';

/** CLDR-style suffix of the singular / plural sibling keys (`..._one` / `..._other`). */
function pluralSuffix(count: number): '_one' | '_other' {
    return count === 1 ? '_one' : '_other';
}

/** Format plan names as a localized conjunction list ("A y B", "A, B y C"). */
export function formatPlanNameList({
    locale,
    names
}: {
    readonly locale: SupportedLocale;
    readonly names: readonly string[];
}): string {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
}

/**
 * Message of the collections plan gate. Names the catalog plans that carry collections, or
 * a plan-free sentence when the catalog could not be read.
 */
export function resolveCollectionsGateMessage({
    locale,
    planNames,
    t
}: {
    readonly locale: SupportedLocale;
    readonly planNames: readonly string[];
    /** The caller's own translation function, so the helper imports no i18n runtime. */
    readonly t: TranslationFn;
}): string {
    if (planNames.length === 0) {
        return t(
            'account.favorites.collections.upgrade.messageNoPlans',
            'Las colecciones no están incluidas en tu plan actual. Actualizá tu plan para acceder.'
        );
    }
    return t(
        `account.favorites.collections.upgrade.message${pluralSuffix(planNames.length)}`,
        undefined,
        { plans: formatPlanNameList({ locale, names: planNames }) }
    );
}

/**
 * Hint of the promotion form's VIP-only toggle: which tourists see the promotion when the
 * toggle is off. Names the catalog plans that carry exclusive deals.
 */
export function resolvePromotionAudienceHint({
    locale,
    planNames,
    t
}: {
    readonly locale: SupportedLocale;
    readonly planNames: readonly string[];
    /** The caller's own translation function, so the helper imports no i18n runtime. */
    readonly t: TranslationFn;
}): string {
    if (planNames.length === 0) {
        return t(
            'host.promotions.fields.vipOnlyHintNoPlans',
            'Si la activás, esta promoción solo la van a ver los turistas con plan VIP. Si la dejás apagada, la ven todos los turistas con acceso a las ofertas exclusivas.'
        );
    }
    return t(`host.promotions.fields.vipOnlyHint${pluralSuffix(planNames.length)}`, undefined, {
        plans: formatPlanNameList({ locale, names: planNames })
    });
}

/**
 * Message of a tourist plan gate that names the catalog plans carrying the gated feature.
 * Reads `<keyBase>_one` / `<keyBase>_other` (with a `{{plans}}` placeholder) or, when the
 * catalog could not be read, `<keyBase>NoPlans` — which names no plan at all.
 */
export function resolvePlanGateMessage({
    keyBase,
    locale,
    noPlansFallback,
    planNames,
    t
}: {
    /** i18n key prefix, e.g. `account.exclusiveDeals.upgrade.message`. */
    readonly keyBase: string;
    readonly locale: SupportedLocale;
    /** Spanish plan-free sentence used when the key is missing. */
    readonly noPlansFallback: string;
    readonly planNames: readonly string[];
    /** The caller's own translation function, so the helper imports no i18n runtime. */
    readonly t: TranslationFn;
}): string {
    if (planNames.length === 0) {
        return t(`${keyBase}NoPlans`, noPlansFallback);
    }
    return t(`${keyBase}${pluralSuffix(planNames.length)}`, undefined, {
        plans: formatPlanNameList({ locale, names: planNames })
    });
}
