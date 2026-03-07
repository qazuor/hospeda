/**
 * Shared page-level helpers to reduce boilerplate across Astro pages.
 * Provides locale validation, breadcrumb constants, and static path generation.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, isValidLocale } from './i18n';

/**
 * Extracts and validates the locale from Astro route params.
 * Returns the validated locale or null if invalid (caller must handle redirect).
 */
export function getLocaleFromParams(params: {
    lang?: string;
}): SupportedLocale | null {
    const { lang } = params;
    if (!lang || !isValidLocale(lang)) {
        return null;
    }
    return lang;
}

/**
 * Localized "Home" breadcrumb labels for all supported locales.
 */
export const HOME_BREADCRUMB: Readonly<Record<SupportedLocale, string>> = {
    es: 'Inicio',
    en: 'Home',
    pt: 'Inicio'
} as const;

/**
 * Generates static paths for all supported locales.
 * Use this in `getStaticPaths` for pages that only vary by locale.
 */
export function getStaticLocalePaths(): Array<{ params: { lang: string } }> {
    return SUPPORTED_LOCALES.map((lang) => ({ params: { lang } }));
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isValidLocale, type SupportedLocale };
