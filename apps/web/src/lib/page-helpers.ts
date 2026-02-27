/**
 * Shared page-level helpers to reduce boilerplate across Astro pages.
 * Provides locale validation, breadcrumb constants, and static path generation.
 */

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, isValidLocale } from './i18n';

/**
 * Validates the `lang` route parameter and returns a typed locale.
 * If validation fails, returns a redirect Response to the default locale.
 *
 * @param params - Object containing the `lang` route parameter.
 * @returns The validated locale string, or a Response redirect for invalid locales.
 *
 * @example
 * ```astro
 * ---
 * import { validateLocale } from '../../lib/page-helpers';
 *
 * const localeOrRedirect = validateLocale(Astro.params);
 * if (localeOrRedirect instanceof Response) return localeOrRedirect;
 * const locale = localeOrRedirect;
 * ---
 * ```
 */
export function validateLocale(params: {
    lang?: string;
}): SupportedLocale | Response {
    const { lang } = params;
    if (!lang || !isValidLocale(lang)) {
        return Response.redirect(new URL(`/${DEFAULT_LOCALE}/`, 'http://localhost'), 302);
    }
    return lang;
}

/**
 * Extracts and validates the locale from Astro route params.
 * Returns the validated locale or null if invalid (caller must handle redirect).
 *
 * @param params - Object containing the `lang` route parameter.
 * @returns The validated locale or null.
 *
 * @example
 * ```astro
 * ---
 * import { getLocaleFromParams } from '../../lib/page-helpers';
 *
 * const locale = getLocaleFromParams(Astro.params);
 * if (!locale) return Astro.redirect('/es/');
 * ---
 * ```
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
 * Use this instead of defining `homeLabels` inline in each page.
 *
 * @example
 * ```ts
 * const breadcrumbItems = [
 *   { label: HOME_BREADCRUMB[locale], href: `/${locale}/` },
 *   { label: pageTitle, href: currentPath },
 * ];
 * ```
 */
export const HOME_BREADCRUMB: Readonly<Record<SupportedLocale, string>> = {
    es: 'Inicio',
    en: 'Home',
    pt: 'Início'
} as const;

/**
 * Generates static paths for all supported locales.
 * Use this in `getStaticPaths` for pages that only vary by locale.
 *
 * @returns Array of path objects for each supported locale.
 *
 * @example
 * ```astro
 * ---
 * import { getStaticLocalePaths } from '../../lib/page-helpers';
 *
 * export const prerender = true;
 * export const getStaticPaths = getStaticLocalePaths;
 * ---
 * ```
 */
export function getStaticLocalePaths(): Array<{ params: { lang: string } }> {
    return SUPPORTED_LOCALES.map((lang) => ({ params: { lang } }));
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isValidLocale, type SupportedLocale };
