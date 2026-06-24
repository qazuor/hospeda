/**
 * @fileoverview
 * Dynamic sitemap endpoint emitting XML for all published entities.
 *
 * Fetches accommodations, destinations, events, and posts in parallel.
 * Generates one <url> entry per entity per supported locale (es, en, pt).
 * Partial results are returned if one or more fetches fail — the whole
 * sitemap is never blocked by a single failing entity type.
 *
 * Cache: public, 24h (max-age=86400) with stale-while-revalidate=86400.
 *
 * Route: GET /sitemap-dynamic.xml
 * Rendering: SSR (prerender = false — must always reflect current published data)
 */

import type { APIRoute } from 'astro';
import { getApiUrl, getSiteUrl } from '../lib/env';

export const prerender = false;

/**
 * Supported locales and their URL prefix.
 *
 * SPEC-157 REQ-2: es uses the /es prefix (not empty) so every Spanish sitemap
 * URL matches the page canonical and returns HTTP 200. The unprefixed form
 * 302-redirects to /es/, which made crawlers see a sitemap full of redirecting
 * URLs disagreeing with the declared canonical (crawl-budget + trust problem).
 */
const LOCALES = [
    { code: 'es', prefix: '/es' },
    { code: 'en', prefix: '/en' },
    { code: 'pt', prefix: '/pt' }
] as const;

/** Minimal shape expected from each paginated entity list response. */
interface EntityItem {
    readonly slug: string;
    readonly updatedAt?: string;
    readonly updated_at?: string;
}

interface PaginatedResponse {
    readonly items: readonly EntityItem[];
}

interface ApiResponse {
    readonly success: boolean;
    readonly data?: PaginatedResponse | EntityItem[];
}

/**
 * Fetch all pages of an entity list from the public API.
 * Returns an empty array on any fetch/parse failure so the sitemap degrades gracefully.
 *
 * @param baseUrl - API base URL without trailing slash
 * @param path - API path (e.g. '/api/v1/public/accommodations')
 * @param params - Additional query parameters
 */
async function fetchAllEntities(
    baseUrl: string,
    path: string,
    params: Record<string, string> = {}
): Promise<readonly EntityItem[]> {
    // The public list endpoints cap pageSize at 100 (Zod validation); a larger
    // value returns HTTP 400, which breaks the fetch loop and yields an empty
    // sitemap. Keep this <= the API max.
    const pageSize = 100;
    const allItems: EntityItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        const searchParams = new URLSearchParams({
            page: String(page),
            pageSize: String(pageSize),
            ...params
        });

        try {
            const response = await fetch(`${baseUrl}${path}?${searchParams.toString()}`, {
                signal: AbortSignal.timeout(15_000)
            });

            if (!response.ok) break;

            const json = (await response.json()) as ApiResponse;
            if (!json.success) break;

            let items: readonly EntityItem[] = [];

            // The public list endpoints return { success, data: { items, pagination } }.
            // Read `data.items`; keep the bare-array fallback for resilience.
            if (
                json.data &&
                'items' in json.data &&
                Array.isArray((json.data as PaginatedResponse).items)
            ) {
                items = (json.data as PaginatedResponse).items;
            } else if (Array.isArray(json.data)) {
                items = json.data as EntityItem[];
            }

            allItems.push(...items);

            // If we received fewer items than a full page, we are done
            hasMore = items.length === pageSize;
            page += 1;
        } catch {
            // Network error, timeout, JSON parse failure — stop paging
            break;
        }
    }

    return allItems;
}

/**
 * Build <url> XML block for an entity.
 *
 * @param loc - Absolute URL string
 * @param lastmod - ISO date string for last modification (optional)
 * @param changefreq - Sitemap changefreq value
 * @param priority - Sitemap priority (0.0–1.0)
 */
function buildUrlEntry({
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
    /** Pre-rendered <xhtml:link> hreflang alternates block (one line each). */
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
 * Generate sitemap entries for all items of an entity type across all locales.
 *
 * @param items - Entity items from the API
 * @param siteUrl - Site base URL without trailing slash
 * @param pathFn - Function to build the path segment from an entity's slug
 * @param changefreq - Sitemap changefreq
 * @param priority - Sitemap priority
 */
function buildEntriesForEntity({
    items,
    siteUrl,
    pathFn,
    changefreq,
    priority
}: {
    readonly items: readonly EntityItem[];
    readonly siteUrl: string;
    readonly pathFn: (slug: string) => string;
    readonly changefreq: string;
    readonly priority: number;
}): string[] {
    const entries: string[] = [];

    for (const item of items) {
        if (!item.slug) continue;

        const lastmod = item.updatedAt ?? item.updated_at ?? new Date().toISOString().split('T')[0];
        const path = pathFn(item.slug);

        // SPEC-157 REQ-12: the hreflang alternate set is shared by every locale
        // variant of this entity. x-default points to the Spanish (default) URL.
        const alternateLinks = LOCALES.map(
            ({ code, prefix }) =>
                `    <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${prefix}${path}"/>`
        );
        const esPrefix = LOCALES.find((locale) => locale.code === 'es')?.prefix ?? '';
        alternateLinks.push(
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${esPrefix}${path}"/>`
        );
        const alternates = `${alternateLinks.join('\n')}\n`;

        for (const { prefix } of LOCALES) {
            const loc = `${siteUrl}${prefix}${path}`;
            entries.push(buildUrlEntry({ loc, lastmod, changefreq, priority, alternates }));
        }
    }

    return entries;
}

export const GET: APIRoute = async () => {
    let apiUrl: string;
    let siteUrl: string;

    try {
        apiUrl = getApiUrl();
        siteUrl = getSiteUrl().replace(/\/$/, '');
    } catch {
        return new Response('<!-- sitemap unavailable: env not configured -->', {
            status: 503,
            headers: { 'Content-Type': 'application/xml' }
        });
    }

    const base = '/api/v1/public';
    const esPrefix = LOCALES.find((l) => l.code === 'es')?.prefix ?? '';

    // Fetch all entity types in parallel. Individual failures degrade gracefully.
    // No `status` filter: the public list endpoints already return only public
    // (published) content, and they reject an unknown `status` query param with
    // HTTP 400 — which previously made every entity fetch fail and the sitemap
    // come back empty.
    const [accommodations, destinations, events, posts, gastronomy, experiences] =
        await Promise.allSettled([
            fetchAllEntities(apiUrl, `${base}/accommodations`),
            fetchAllEntities(apiUrl, `${base}/destinations`),
            fetchAllEntities(apiUrl, `${base}/events`),
            fetchAllEntities(apiUrl, `${base}/posts`),
            fetchAllEntities(apiUrl, `${base}/gastronomy`),
            fetchAllEntities(apiUrl, `${base}/experiences`)
        ]);

    const resolvedAccommodations =
        accommodations.status === 'fulfilled' ? accommodations.value : [];
    const resolvedDestinations = destinations.status === 'fulfilled' ? destinations.value : [];
    const resolvedEvents = events.status === 'fulfilled' ? events.value : [];
    const resolvedPosts = posts.status === 'fulfilled' ? posts.value : [];
    const resolvedGastronomy = gastronomy.status === 'fulfilled' ? gastronomy.value : [];
    const resolvedExperiences = experiences.status === 'fulfilled' ? experiences.value : [];

    const entries: string[] = [];

    // ── Static listing pages (priority 0.7) ──────────────────────────────
    // These are SSR pages (not SSG), so @astrojs/sitemap does not include them.
    // Listing pages: /{lang}/alojamientos/, /destinos/, /eventos/, /gastronomia/,
    //                /experiencias/, /publicaciones/
    const LISTING_PATHS = [
        'alojamientos',
        'destinos',
        'eventos',
        'gastronomia',
        'experiencias',
        'publicaciones'
    ] as const;

    for (const listingPath of LISTING_PATHS) {
        const alternateLinks = LOCALES.map(
            ({ code, prefix }) =>
                `    <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${prefix}/${listingPath}/"/>`
        );
        alternateLinks.push(
            `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${esPrefix}/${listingPath}/"/>`
        );
        const alternates = `${alternateLinks.join('\n')}\n`;

        for (const { prefix } of LOCALES) {
            entries.push(
                buildUrlEntry({
                    loc: `${siteUrl}${prefix}/${listingPath}/`,
                    lastmod: new Date().toISOString().split('T')[0],
                    changefreq: 'weekly',
                    priority: 0.7,
                    alternates
                })
            );
        }
    }

    // ── Home page (priority 1.0) ─────────────────────────────────────────
    // The home is SSG and appears in @astrojs/sitemap, but that integration
    // doesn't set priority. We emit it here with 1.0 to override.
    const homeAlternates = [
        ...LOCALES.map(
            ({ code, prefix }) =>
                `    <xhtml:link rel="alternate" hreflang="${code}" href="${siteUrl}${prefix}/"/>`
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${esPrefix}/"/>`
    ].join('\n');
    for (const { prefix } of LOCALES) {
        entries.push(
            buildUrlEntry({
                loc: `${siteUrl}${prefix}/`,
                lastmod: new Date().toISOString().split('T')[0],
                changefreq: 'daily',
                priority: 1.0,
                alternates: `${homeAlternates}\n`
            })
        );
    }

    // ── Detail entity pages (priority 0.8) ───────────────────────────────

    // Accommodations: /alojamientos/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedAccommodations,
            siteUrl,
            pathFn: (slug) => `/alojamientos/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Destinations: /destinos/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedDestinations,
            siteUrl,
            pathFn: (slug) => `/destinos/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Events: /eventos/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedEvents,
            siteUrl,
            pathFn: (slug) => `/eventos/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Posts: /publicaciones/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedPosts,
            siteUrl,
            pathFn: (slug) => `/publicaciones/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Gastronomy: /gastronomia/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedGastronomy,
            siteUrl,
            pathFn: (slug) => `/gastronomia/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Experiences: /experiencias/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedExperiences,
            siteUrl,
            pathFn: (slug) => `/experiencias/${slug}/`,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400'
        }
    });
};
