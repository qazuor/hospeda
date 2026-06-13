/**
 * URL builder utilities for internal links with guaranteed trailing slashes.
 * Ensures consistency with Astro's `trailingSlash: 'always'` configuration.
 */

import { SUPPORTED_LOCALES, type SupportedLocale } from './i18n';

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

/**
 * Rebuild the current path with its leading locale segment swapped, for use with
 * the `window.location.pathname` setter.
 *
 * The returned value is assigned to `location.pathname` (NOT `location.assign`):
 * the `pathname` setter only ever replaces the path component, so it cannot carry
 * a scheme or authority and the navigation is inherently same-origin. A crafted
 * path therefore can never become a `javascript:` or cross-origin navigation —
 * the safe API is the guard, which is why this also clears CodeQL's
 * `js/xss-through-dom` finding (no `javascript:`-capable sink is involved). The
 * current query string and fragment are preserved automatically by the browser.
 *
 * @param params - Switch parameters.
 * @param params.pathname - The current `location.pathname`.
 * @param params.locale - The locale to place in the first path segment.
 * @returns The new path string (`/{locale}/...`), or `null` when the current
 *   first segment is not a supported locale (nothing to switch).
 *
 * @example
 * ```ts
 * buildLocaleSwitchPathname({ pathname: '/es/mi-cuenta/', locale: 'en' });
 * // Returns: '/en/mi-cuenta/'
 * ```
 */
export function buildLocaleSwitchPathname({
    pathname,
    locale
}: {
    readonly pathname: string;
    readonly locale: SupportedLocale;
}): string | null {
    const segments = pathname.split('/');
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(segments[1] ?? '')) {
        return null;
    }
    segments[1] = locale;
    return segments.join('/');
}
