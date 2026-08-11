/**
 * @fileoverview
 * Shared XML builders for the sitemap family.
 *
 * Every sitemap this app serves is an SSR endpoint under `src/pages`:
 *
 * | Route                  | Contents                                          |
 * |------------------------|---------------------------------------------------|
 * | `/sitemap-index.xml`   | The `<sitemapindex>` robots.txt points at         |
 * | `/sitemap-static.xml`  | Hand-curated marketing/informational pages        |
 * | `/sitemap-dynamic.xml` | Published entities + facet landings (DB-driven)   |
 *
 * There is deliberately NO `@astrojs/sitemap` integration. That integration
 * only enumerates routes emitted as static HTML at build time, and this app
 * renders every route on demand (zero `prerender = true` pages), so it emitted
 * a `<urlset>` containing no pages at all. Worse, the only way to reference the
 * dynamic sitemap from it was `customPages`, which appends to the `<urlset>` —
 * advertising `sitemap-dynamic.xml` as a crawlable *page* rather than
 * registering it as a *sitemap*, so its URLs were never submitted. Serving the
 * index ourselves fixes both and makes the sitemaps behave identically in
 * `astro dev` and in production.
 *
 * This module owns the locale list and the XML string shapes so the two url-set
 * endpoints cannot drift apart.
 */

import { CACHE_TAG_COLLECTIONS } from '@repo/cache-tags';
import type { CacheTagList } from '../cache/response-cache.js';
import { buildStaticCacheHeaders } from '../cache/response-cache.js';

/**
 * Supported locales and their URL prefix, ordered es/en/pt.
 *
 * SPEC-157 REQ-2: `es` uses the `/es` prefix (not the empty string) so every
 * Spanish sitemap URL matches the page canonical and returns HTTP 200. The
 * unprefixed form 301-redirects to `/es/`, which made crawlers see a sitemap
 * full of redirecting URLs disagreeing with the declared canonical (a crawl
 * budget + trust problem).
 */
export const SITEMAP_LOCALES = [
    { code: 'es', prefix: '/es' },
    { code: 'en', prefix: '/en' },
    { code: 'pt', prefix: '/pt' }
] as const;

/** URL prefix of the default locale, and the `x-default` hreflang target. */
export const SITEMAP_DEFAULT_LOCALE_PREFIX =
    SITEMAP_LOCALES.find((locale) => locale.code === 'es')?.prefix ?? '';

/**
 * Build the pre-rendered `<xhtml:link>` hreflang block shared by every locale
 * variant of one page.
 *
 * The same block is embedded in all three `<url>` entries for a page: hreflang
 * annotations must be reciprocal, so each variant advertises the full set
 * including itself. `x-default` points at the Spanish URL (SPEC-157 REQ-12).
 *
 * @param path - Locale-agnostic path with leading and trailing slash (e.g. `/nosotros/`)
 * @param siteUrl - Absolute site origin, without a trailing slash
 * @returns The block, one indented link per line, terminated by a newline
 */
export function buildAlternatesBlock({
    path,
    siteUrl
}: {
    readonly path: string;
    readonly siteUrl: string;
}): string {
    const links = SITEMAP_LOCALES.map(
        ({ code, prefix }) =>
            `    <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${prefix}${path}"/>`
    );
    links.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${SITEMAP_DEFAULT_LOCALE_PREFIX}${path}"/>`
    );

    return `${links.join('\n')}\n`;
}

/**
 * Build a single `<url>` entry.
 *
 * @param loc - Absolute URL
 * @param lastmod - ISO date string; the tag is omitted entirely when absent
 * @param changefreq - Sitemap `changefreq` value
 * @param priority - Sitemap priority, emitted with one decimal
 * @param alternates - Pre-rendered hreflang block from {@link buildAlternatesBlock}
 */
export function buildUrlEntry({
    loc,
    lastmod,
    changefreq,
    priority,
    alternates
}: {
    readonly loc: string;
    readonly lastmod?: string;
    readonly changefreq: string;
    readonly priority: number;
    readonly alternates: string;
}): string {
    const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
    return `  <url>
    <loc>${loc}</loc>${lastmodTag}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
${alternates}  </url>`;
}

/**
 * Build every `<url>` entry for one page: one per locale, all carrying the same
 * hreflang block.
 *
 * @param path - Locale-agnostic path with leading and trailing slash
 * @param siteUrl - Absolute site origin, without a trailing slash
 * @param lastmod - Optional ISO date string applied to all locale variants
 * @param changefreq - Sitemap `changefreq` value
 * @param priority - Sitemap priority
 */
export function buildLocalizedUrlEntries({
    path,
    siteUrl,
    lastmod,
    changefreq,
    priority
}: {
    readonly path: string;
    readonly siteUrl: string;
    readonly lastmod?: string;
    readonly changefreq: string;
    readonly priority: number;
}): string[] {
    const alternates = buildAlternatesBlock({ path, siteUrl });

    return SITEMAP_LOCALES.map(({ prefix }) =>
        buildUrlEntry({
            loc: `${siteUrl}${prefix}${path}`,
            lastmod,
            changefreq,
            priority,
            alternates
        })
    );
}

/**
 * Wrap `<url>` entries in the `<urlset>` document envelope.
 *
 * @param entries - Entries produced by {@link buildUrlEntry}
 */
export function buildUrlsetDocument(entries: readonly string[]): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;
}

/**
 * Build a `<sitemapindex>` document.
 *
 * This is the piece `@astrojs/sitemap`'s `customPages` could not express: a
 * child sitemap belongs in a `<sitemap><loc>` inside a `<sitemapindex>`, never
 * in a `<url><loc>` inside a `<urlset>`.
 *
 * @param locations - Absolute URLs of the child sitemaps
 * @param lastmod - ISO date string stamped on every child entry
 */
export function buildSitemapIndexDocument({
    locations,
    lastmod
}: {
    readonly locations: readonly string[];
    readonly lastmod: string;
}): string {
    const entries = locations.map(
        (loc) => `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`
    );

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</sitemapindex>`;
}

/**
 * Cache tags for every sitemap: one per collection a sitemap can list.
 *
 * Deliberately broad. A sitemap enumerates a whole collection, so any member's
 * creation, deletion or slug change alters it — and sitemaps are cheap to
 * regenerate, unlike the 24 h of staleness the narrower alternative buys.
 * Whole-zone purge used to cover this for free (HOS-369 §5.5); selective purge
 * does not, so it is stated here.
 */
// The leading element is pinned so the value satisfies `CacheTagList`'s
// at-least-one-tag tuple without a cast; the spread that follows keeps the list
// exhaustive as new collections are added. The repeat is deduplicated by
// `buildStaticCacheHeaders`.
const SITEMAP_CACHE_TAGS: CacheTagList = [
    CACHE_TAG_COLLECTIONS.accommodation,
    ...Object.values(CACHE_TAG_COLLECTIONS)
];

/**
 * Response headers shared by every sitemap endpoint: XML, cached 24h.
 *
 * Sitemap endpoints bypass middleware (the `.xml` extension short-circuits
 * `isStaticAssetRoute`), so the `Cache-Tag` header is set here rather than by
 * the Step 11 collector, which never sees these responses (HOS-369 W1-1).
 *
 * A FUNCTION rather than the frozen object literal it used to be (HOS-369
 * W1-2): the tags are now namespaced by deployment environment, and that
 * namespace is resolved from the environment rather than known at module-eval
 * time. Calling it per response also means a deployment whose namespace cannot
 * be resolved emits `private, no-cache` instead of a cacheable response nothing
 * can purge — the same fail-closed rule `applyCacheHeaders` applies to pages.
 *
 * @returns The exact header pairs each sitemap endpoint should send.
 */
export function getSitemapResponseHeaders(): Readonly<Record<string, string>> {
    return {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildStaticCacheHeaders({
            cacheControl: 'public, max-age=86400, stale-while-revalidate=86400',
            tags: SITEMAP_CACHE_TAGS
        })
    };
}
