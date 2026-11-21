/**
 * @file my-plan-labels.ts
 * @description The label helpers of `readMyPlan` and its Tourist VIP blocks
 * (HOS-2328, HOS-2398): every owner-facing string comes from `@repo/i18n` in
 * the caller's locale, with an `es` fallback, never from a code map.
 */

import type { Locale } from '@repo/i18n';
import { isUnlimitedLimit } from '@repo/schemas';
import { translateCatalogKey } from '../../../services/ai-context/listing-labels';
import type { toEffectiveSetView } from '../../../utils/listing-access/effective-set-view';
import type { MyPlanIncludes } from './my-plan-types';

/**
 * A label from the catalogue, or the fallback when the key has none.
 *
 * @param input.key - Flattened `@repo/i18n` key.
 * @param input.locale - The caller's locale.
 * @param input.fallback - What to show when neither the locale nor `es` has it.
 * @returns The label.
 */
export function label(input: {
    readonly key: string;
    readonly locale: Locale;
    readonly fallback: string;
}): string {
    return translateCatalogKey({ key: input.key, locale: input.locale }).label ?? input.fallback;
}

/**
 * An effective-set view as labelled entitlements and limits.
 *
 * @param view - The view `toEffectiveSetView` builds.
 * @param locale - The caller's locale.
 * @returns Granted entitlements as labels and limits with their values; a limit
 * that is `Infinity` or at/above the catalog sentinel is `unlimited` (HOS-2403).
 */
export function labelView(
    view: ReturnType<typeof toEffectiveSetView>,
    locale: Locale
): MyPlanIncludes {
    const entitlements = Object.entries(view.entitlements)
        .filter(([, value]) => value === 'Infinity' || value > 0)
        .map(([key]) => label({ key: `billing.entitlement.${key}`, locale, fallback: key }));
    const limits = Object.entries(view.limits).map(([key, value]) => ({
        label: label({ key: `billing.comparison.limitLabel.${key}`, locale, fallback: key }),
        value: value === 'Infinity' || isUnlimitedLimit({ value }) ? ('unlimited' as const) : value
    }));
    return { entitlements, limits };
}
