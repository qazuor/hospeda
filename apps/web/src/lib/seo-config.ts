/**
 * Shared SEO configuration constants.
 *
 * This module is the single source of truth for path prefixes that must be
 * excluded from the sitemap AND disallowed in robots.txt: `src/pages/robots.txt.ts`
 * emits them as `Disallow:` directives, and the static-sitemap drift guard
 * uses {@link isExcludedSitemapPage} to skip them when checking that every
 * page has been classified.
 *
 * Locale prefixes and hreflang construction do NOT live here — they belong to
 * `src/lib/seo/sitemap-xml.ts`, which every sitemap endpoint shares.
 *
 * The file must remain pure — no Astro runtime APIs, no `import.meta.env`, no
 * side-effects.
 */

/**
 * URL path prefixes that are excluded from the sitemap and must not be
 * indexed by search engines.
 *
 * Each entry is tested with `String.prototype.includes()` against the full
 * page URL in the sitemap filter, and emitted as a `Disallow:` directive in
 * `robots.txt`. The leading `/` is mandatory.
 */
export const SITEMAP_EXCLUDED_PATHS = ['/auth/', '/mi-cuenta/', '/feedback/'] as const;

/** Inferred union type of all excluded path prefixes. */
export type SitemapExcludedPath = (typeof SITEMAP_EXCLUDED_PATHS)[number];

/**
 * Decide whether a page must be omitted from the sitemap.
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
