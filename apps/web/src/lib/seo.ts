/**
 * @file seo.ts
 * @description Helpers for resolving locale-aware SEO metadata.
 */

import type { SupportedLocale } from './i18n';

/** Locale the stored SEO overrides are authored in (the platform default). */
const SEO_SOURCE_LOCALE: SupportedLocale = 'es';

/**
 * Picks a stored SEO override (title or description) only when rendering the
 * source locale, falling back to a localized value otherwise.
 *
 * Stored `seo.title` / `seo.description` are authored once, in the default
 * locale (`es`); there is no per-locale SEO override field. On `en` / `pt`
 * routes the stored Spanish value would otherwise leak into the page `<title>`
 * and meta description even though the visible content (name, summary) is
 * localized. For those locales we prefer the already-localized fallback.
 *
 * @param stored - Stored SEO override (source-locale text), or nullish/empty.
 * @param fallback - Localized fallback used on non-source locales (and when
 *   `stored` is empty).
 * @param locale - Current page locale.
 * @returns The stored override on the source locale, otherwise the fallback.
 */
export function pickLocalizedSeo({
    stored,
    fallback,
    locale
}: {
    readonly stored: string | null | undefined;
    readonly fallback: string;
    readonly locale: SupportedLocale;
}): string {
    return locale === SEO_SOURCE_LOCALE && stored ? stored : fallback;
}
