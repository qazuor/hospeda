/**
 * Proof-of-Metro-resolution: imports @repo/i18n and @repo/schemas so the
 * bundler actually pulls them in at build time (T-002 verification).
 *
 * @repo/i18n  — main: ./src/index.ts  → resolved directly from src (no build needed)
 * @repo/schemas — main: dist/index.js → resolved from built dist (must be built)
 */

import { defaultLocale, locales, trans } from '@repo/i18n';
import type { Locale } from '@repo/i18n';
import { LifecycleStatusEnum } from '@repo/schemas';

/**
 * All supported locale codes, sourced from @repo/i18n.
 *
 * @example
 * ```ts
 * supportedLocales // ['es', 'en', 'pt']
 * ```
 */
export const supportedLocales: readonly string[] = locales;

/**
 * The default locale for the Hospeda platform ('es').
 */
export const appDefaultLocale: Locale = defaultLocale;

/**
 * Retrieves a translated string for the given flat dot-notation key and locale.
 *
 * Falls back to the default locale when the key is missing in the requested locale.
 *
 * @param key - Dot-notation translation key, e.g. `'common.buttons.save'`
 * @param locale - Target locale. Defaults to `appDefaultLocale`.
 * @returns The translated string, or a `[MISSING: key]` sentinel on lookup failure.
 *
 * @example
 * ```ts
 * getTranslation('common.accommodations')         // 'Alojamientos'
 * getTranslation('common.accommodations', 'en')   // 'Accommodations'
 * ```
 */
export function getTranslation(key: string, locale: Locale = appDefaultLocale): string {
    const localeMap = trans[locale] ?? trans[appDefaultLocale];
    const fallback = trans[appDefaultLocale];
    return localeMap[key] ?? fallback[key] ?? `[MISSING: ${key}]`;
}

/**
 * Lifecycle status values for accommodation and other entities.
 * Re-exported from @repo/schemas for use in mobile screens.
 */
export { LifecycleStatusEnum };
