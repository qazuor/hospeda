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
 * Rebuild the current location's path with its leading locale segment swapped,
 * returning a guaranteed same-origin navigation target.
 *
 * The result is meant to be handed to `window.location.assign`. Because the
 * target is reconstructed from `window.location` (`pathname`/`search`/`hash`),
 * which is attacker-influenceable DOM text, the rebuilt value is resolved
 * against the current origin and only returned when it stays same-origin. This
 * is defence-in-depth: it prevents a crafted path/hash from ever smuggling a
 * non-same-origin (e.g. `javascript:` or protocol-relative) URL into the
 * navigation sink, and it also clears CodeQL's `js/xss-through-dom` finding.
 *
 * @param params - Switch parameters.
 * @param params.location - The current location (only `pathname`, `search`,
 *   `hash`, and `origin` are read).
 * @param params.locale - The locale to place in the first path segment.
 * @returns A same-origin path string (`/{locale}/...?...#...`), or `null` when
 *   the current first segment is not a supported locale (nothing to switch) or
 *   the rebuilt target would not resolve same-origin.
 *
 * @example
 * ```ts
 * buildLocaleSwitchTarget({ location: window.location, locale: 'en' });
 * // From '/es/mi-cuenta/?tab=1#top' -> '/en/mi-cuenta/?tab=1#top'
 * ```
 */
export function buildLocaleSwitchTarget({
    location,
    locale
}: {
    readonly location: Pick<Location, 'pathname' | 'search' | 'hash' | 'origin'>;
    readonly locale: SupportedLocale;
}): string | null {
    const segments = location.pathname.split('/');
    if (!(SUPPORTED_LOCALES as readonly string[]).includes(segments[1] ?? '')) {
        return null;
    }
    segments[1] = locale;
    const relative = `${segments.join('/')}${location.search}${location.hash}`;
    let resolved: URL;
    try {
        resolved = new URL(relative, location.origin);
    } catch {
        return null;
    }
    if (resolved.origin !== location.origin) {
        return null;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
