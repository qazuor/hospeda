/**
 * Pluralization utility for i18n.
 *
 * Resolves CLDR-style `_one` / `_other` translation keys based on count.
 * Works with any translation function that follows the `(key, params?) => string` signature.
 */

import { isMissingTranslation } from './missing-translation';

/** Translation function signature compatible with both @repo/i18n hook and web's t() */
type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * Resolves the correct plural form of a translation key based on count.
 *
 * Uses the CLDR `_one` / `_other` convention:
 * - `key_one` is used when `count === 1`
 * - `key_other` is used for all other values (0, 2, 3, ...)
 *
 * Automatically injects `{{count}}` into the params for interpolation.
 * Falls back to the base key if neither `_one` nor `_other` variants exist.
 * The fallback triggers identically in development and production builds — see
 * {@link isMissingTranslation} for why that needed stating.
 *
 * @param params - Object with translation function, base key, count, and optional extra params.
 * @param params.t - The translation function to use for key resolution.
 * @param params.key - The base translation key (without `_one` / `_other` suffix).
 * @param params.count - The count value used to determine plural form.
 * @param params.params - Optional additional parameters for interpolation alongside count.
 * @returns The resolved and interpolated translation string.
 *
 * @example
 * ```ts
 * // Given translations: { "items_one": "{{count}} item", "items_other": "{{count}} items" }
 * pluralize({ t, key: 'items', count: 1 });  // "1 item"
 * pluralize({ t, key: 'items', count: 5 });  // "5 items"
 *
 * // With additional params:
 * pluralize({ t, key: 'results', count: 3, params: { city: 'Buenos Aires' } });
 * // "3 results in Buenos Aires"
 * ```
 */
export function pluralize({
    t,
    key,
    count,
    params
}: {
    readonly t: TranslationFn;
    readonly key: string;
    readonly count: number;
    readonly params?: Record<string, unknown>;
}): string {
    const mergedParams: Record<string, unknown> = { ...params, count };

    const suffix = count === 1 ? '_one' : '_other';
    const pluralKey = `${key}${suffix}`;

    // Try the plural-specific key first
    const result = t(pluralKey, mergedParams);

    // If the plural key is missing, fall back to the base key. Absence is
    // decided by the canonical predicate, NOT by the `[MISSING:` marker: that
    // marker is emitted only by development builds, so a marker-only check let
    // the raw dotted key reach production users (see missing-translation.ts).
    if (isMissingTranslation({ key: pluralKey, value: result })) {
        return t(key, mergedParams);
    }

    return result;
}
