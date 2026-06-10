/**
 * Shared SEO configuration constants.
 *
 * This module is the single source of truth for path prefixes that must be
 * excluded from the sitemap AND disallowed in robots.txt.
 *
 * Importing this in BOTH `astro.config.mjs` (sitemap filter) and
 * `src/pages/robots.txt.ts` (Disallow directives) keeps the two lists in
 * sync without manual duplication.
 *
 * NOTE: `astro.config.mjs` imports this file at build time via a bare `.ts`
 * import (same pattern as `src/lib/media.ts`). The file must remain pure — no
 * Astro runtime APIs, no `import.meta.env`, no side-effects.
 */

/**
 * URL path prefixes that are excluded from the sitemap and must not be
 * indexed by search engines.
 *
 * Each entry is tested with `String.prototype.includes()` against the full
 * page URL in the sitemap filter, and emitted as a `Disallow:` directive in
 * `robots.txt`. The leading `/` is mandatory.
 */
export const SITEMAP_EXCLUDED_PATHS = [
    '/auth/',
    '/mi-cuenta/',
    '/busqueda/',
    '/feedback/',
    '/beta/'
] as const;

/** Inferred union type of all excluded path prefixes. */
export type SitemapExcludedPath = (typeof SITEMAP_EXCLUDED_PATHS)[number];

/**
 * Supported locale URL prefixes, ordered es/en/pt. `es` is the default locale
 * and the `x-default` target. Single source of truth for the static-sitemap
 * hreflang builder; mirrors the strategy in `src/pages/sitemap-dynamic.xml.ts`
 * (SPEC-157 REQ-2/REQ-12).
 */
const SITEMAP_LOCALE_PREFIXES = ['/es', '/en', '/pt'] as const;

/** Matches a leading locale segment (`/es`, `/en`, `/pt`) only as a full path segment. */
const LEADING_LOCALE_RE = /^\/(es|en|pt)(?=\/|$)/;

/** A single hreflang alternate link for a sitemap `<url>` entry. */
export interface SitemapAlternateLink {
    /** hreflang value: a locale code or `x-default`. */
    readonly lang: string;
    /** Absolute alternate URL. */
    readonly url: string;
}

/**
 * Build the hreflang alternate set for a static-sitemap entry.
 *
 * Strips any leading locale prefix from `pathname` to derive the
 * locale-agnostic path, then re-emits one alternate per locale (es/en/pt) plus
 * `x-default` pointing at the Spanish (`/es`) URL. This guarantees:
 *  - the `es` alternate always carries `/es` (never the unprefixed form, which
 *    301-redirects to `/es/`),
 *  - no locale prefix is ever doubled (e.g. `/en/es/...`),
 *  - parity with the dynamic sitemap (SPEC-157 REQ-2/REQ-12).
 *
 * @param pathname - URL pathname, typically locale-prefixed (e.g. `/en/nosotros/`)
 * @param siteUrl - Absolute site origin; a trailing slash is tolerated
 * @returns Ordered alternates: es, en, pt, x-default
 */
export function buildSitemapAlternateLinks({
    pathname,
    siteUrl
}: {
    readonly pathname: string;
    readonly siteUrl: string;
}): readonly SitemapAlternateLink[] {
    const origin = siteUrl.replace(/\/$/, '');
    const withoutLocale = pathname.replace(LEADING_LOCALE_RE, '');
    const path = withoutLocale === '' ? '/' : withoutLocale;

    const localeLinks: SitemapAlternateLink[] = SITEMAP_LOCALE_PREFIXES.map((prefix) => ({
        lang: prefix.slice(1),
        url: `${origin}${prefix}${path}`
    }));
    localeLinks.push({ lang: 'x-default', url: `${origin}/es${path}` });

    return localeLinks;
}

/**
 * Decide whether a page must be omitted from the static sitemap.
 *
 * Excludes the bare root `/` (it 301-redirects to `/es/`, which is listed
 * separately) and any page under a {@link SITEMAP_EXCLUDED_PATHS} prefix.
 *
 * @param pathname - URL pathname to test
 * @returns `true` when the page must NOT appear in the sitemap
 */
export function isExcludedSitemapPage(pathname: string): boolean {
    if (pathname === '/') {
        return true;
    }
    return SITEMAP_EXCLUDED_PATHS.some((pattern) => pathname.includes(pattern));
}
