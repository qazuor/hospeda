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
