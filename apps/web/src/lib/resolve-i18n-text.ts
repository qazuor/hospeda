/**
 * @file resolve-i18n-text.ts
 * @description Helper to resolve a localized i18n text object to a plain string
 * for the current page locale.
 *
 * PR2 of SPEC-172 changed amenity and feature catalog `name` (and `description`)
 * from a plain `string` to a JSONB i18n object `{ es, en, pt }`. This helper
 * bridges the gap on the web side so transforms and components can always work
 * with plain strings while accepting either shape defensively.
 */

import type { I18nText } from '@repo/schemas';

/** Locale priority order used for fallback resolution. */
const LOCALE_FALLBACK_ORDER = ['es', 'en', 'pt'] as const;

/**
 * Partial i18n text shape accepted defensively when the raw API response
 * has not been parsed through a strict Zod schema (e.g. inside transforms.ts
 * where the raw value arrives as `unknown`).
 *
 * All three locales are optional here so the helper can still extract
 * a value from incomplete payloads without throwing at the type level.
 */
export type I18nTextLike = Partial<I18nText>;

/**
 * Resolves a localized text value to a displayable string for the given locale.
 *
 * Resolution order:
 *  1. The requested locale
 *  2. `es` (platform default)
 *  3. `en`
 *  4. `pt`
 *  5. Empty string as last resort
 *
 * Also accepts a plain `string` (defensive, for endpoints that have not yet
 * migrated to the i18n object shape) — in that case the string is returned
 * as-is.
 *
 * @param value - An `I18nText` object (or partial), a plain string, null, or undefined.
 * @param locale - The desired locale (`es`, `en`, or `pt`).
 * @returns The resolved display string (never null/undefined).
 *
 * @example
 * resolveI18nText({ es: 'Wifi', en: 'Wifi', pt: 'Wifi' }, 'en') // → 'Wifi'
 * resolveI18nText({ es: '', en: 'Pool', pt: 'Piscina' }, 'es')  // → 'Pool'
 * resolveI18nText('wifi', 'en')                                  // → 'wifi'
 * resolveI18nText(null, 'es')                                    // → ''
 */
export function resolveI18nText(
    value: I18nText | I18nTextLike | string | null | undefined,
    locale: string
): string {
    if (!value) return '';

    // Plain string — pass through (defensive: some endpoints may still return strings)
    if (typeof value === 'string') return value;

    const i18n = value as I18nTextLike;

    // Try the requested locale first
    const localeKey = locale as keyof I18nText;
    const localeValue = i18n[localeKey];
    if (localeValue) return localeValue;

    // Fallback through the priority order (es → en → pt)
    for (const fallbackLocale of LOCALE_FALLBACK_ORDER) {
        const fallbackValue = i18n[fallbackLocale];
        if (fallbackValue) return fallbackValue;
    }

    return '';
}
