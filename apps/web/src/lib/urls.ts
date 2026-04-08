/**
 * URL builder utilities for internal links with guaranteed trailing slashes.
 * Ensures consistency with Astro's `trailingSlash: 'always'` configuration.
 */

import type { SupportedLocale } from './i18n';

/**
 * Build an internal URL with locale prefix and guaranteed trailing slash.
 *
 * @param params - URL building parameters.
 * @param params.locale - The locale prefix (es, en, pt).
 * @param params.path - The path segment after locale. Defaults to empty (locale root).
 * @returns A URL string with format `/{locale}/{path}/`.
 *
 * @example
 * ```ts
 * buildUrl({ locale: 'es', path: 'mi-cuenta' });
 * // Returns: '/es/mi-cuenta/'
 *
 * buildUrl({ locale: 'en' });
 * // Returns: '/en/'
 *
 * buildUrl({ locale: 'es', path: 'mi-cuenta/editar' });
 * // Returns: '/es/mi-cuenta/editar/'
 * ```
 */
export function buildUrl({
    locale,
    path = ''
}: {
    readonly locale: SupportedLocale;
    readonly path?: string;
}): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const withTrailingSlash = normalized.endsWith('/') ? normalized : `${normalized}/`;
    return `/${locale}${withTrailingSlash}`;
}

/**
 * Build an internal URL with locale prefix, trailing slash, and query parameters.
 *
 * @param params - URL building parameters.
 * @param params.locale - The locale prefix (es, en, pt).
 * @param params.path - The path segment after locale.
 * @param params.params - Record of query parameter key-value pairs.
 * @returns A URL string with format `/{locale}/{path}/?key=value`.
 *
 * @example
 * ```ts
 * buildUrlWithParams({ locale: 'es', path: 'busqueda', params: { q: 'hotel' } });
 * // Returns: '/es/busqueda/?q=hotel'
 * ```
 */
export function buildUrlWithParams({
    locale,
    path,
    params
}: {
    readonly locale: SupportedLocale;
    readonly path: string;
    readonly params: Readonly<Record<string, string>>;
}): string {
    const base = buildUrl({ locale, path });
    const searchParams = new URLSearchParams(params).toString();
    return searchParams ? `${base}?${searchParams}` : base;
}
