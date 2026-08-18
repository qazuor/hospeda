/**
 * @fileoverview
 * Dynamic sitemap endpoint emitting XML for all published entities.
 *
 * Fetches accommodations, destinations, events, posts and authors in parallel.
 * Generates one <url> entry per entity per supported locale (es, en, pt).
 * Partial results are returned if one or more fetches fail — the whole
 * sitemap is never blocked by a single failing entity type.
 *
 * Author entries (HOS-375 §6.6) carry no filtering of their own: the
 * indexability predicate lives behind `/api/v1/public/authors`, shared with the
 * page itself, so the sitemap cannot advertise a URL the page serves noindex.
 *
 * Also emits static entries for the two facet-landing families promoted to
 * indexable pages by SPEC-306 §4/§7.2-3: event category (9 enum values) and
 * accommodation type (13 enum values). These are fixed enum slugs, not
 * DB-driven, so they skip the API-fetch step entirely.
 *
 * Cache: public, 24h (max-age=86400) with stale-while-revalidate=86400.
 *
 * Route: GET /sitemap-dynamic.xml
 * Rendering: SSR (prerender = false — must always reflect current published data)
 */

import type { APIRoute } from 'astro';
import { getApiUrl, getSiteUrl } from '../lib/env';
import { ACCOMMODATION_TYPE_SLUG_BY_ENUM, EVENT_CATEGORY_SLUG_BY_ENUM } from '../lib/facet-slugs';
import { ENTITY_PUBLIC_PATHS } from '../lib/seo/entity-public-urls';
import { evaluatePartnerIndexability } from '../lib/seo/partner-indexable';
import {
    buildLocalizedUrlEntries,
    buildUrlsetDocument,
    getSitemapResponseHeaders
} from '../lib/seo/sitemap-xml';
import {
    type DestinationListItem,
    destinationListItemCounts,
    isThinDestination
} from '../lib/seo/thin-destination';

export const prerender = false;

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

        // SPEC-157 REQ-12: the hreflang alternate set is shared by every locale
        // variant of this entity. x-default points to the Spanish (default) URL.
        entries.push(
            ...buildLocalizedUrlEntries({
                path: pathFn(item.slug),
                siteUrl,
                lastmod: item.updatedAt ?? item.updated_at,
                changefreq,
                priority
            })
        );
    }

    return entries;
}

/**
 * Generate sitemap entries for a fixed set of facet-landing slugs (no API
 * fetch — the values are static enums). Mirrors `buildEntriesForEntity`'s
 * per-locale + hreflang-alternates output shape so both blocks read the same
 * way in the emitted XML.
 *
 * @param slugs - Static facet-value slugs (e.g. event category, accommodation type)
 * @param siteUrl - Site base URL without trailing slash
 * @param pathFn - Function to build the path segment from a slug
 * @param changefreq - Sitemap changefreq
 * @param priority - Sitemap priority
 */
function buildEntriesForStaticSlugs({
    slugs,
    siteUrl,
    pathFn,
    changefreq,
    priority
}: {
    readonly slugs: readonly string[];
    readonly siteUrl: string;
    readonly pathFn: (slug: string) => string;
    readonly changefreq: string;
    readonly priority: number;
}): string[] {
    const entries: string[] = [];

    for (const slug of slugs) {
        // SPEC-157 REQ-12: the hreflang alternate set is shared by every locale
        // variant of this facet landing. x-default points to the Spanish (default) URL.
        // No `lastmod`: a facet landing has no single underlying row to date.
        entries.push(
            ...buildLocalizedUrlEntries({ path: pathFn(slug), siteUrl, changefreq, priority })
        );
    }

    return entries;
}

/**
 * Attraction facet-landing slugs, restricted to attractions at least one
 * destination actually offers.
 *
 * `/destinos/atraccion/{slug}/` lists the destinations that have the attraction,
 * so an unused one renders an empty page. Only 45 of the 88 catalog rows are in
 * use, and shipping the other 43 as empty URLs is the thin-content pattern this
 * landing exists to avoid.
 *
 * The membership set comes from the destination payloads already fetched above
 * — their embedded `attractions` carry an `id` but no `slug`, hence the id-based
 * intersection with the attraction catalog. No extra requests.
 *
 * @param attractions - Attraction catalog (carries slug + id).
 * @param destinations - Destination list items (carry embedded attractions).
 * @returns The slugs to emit, in catalog order.
 */
function resolveUsedAttractionSlugs(
    attractions: readonly EntityItem[],
    destinations: readonly EntityItem[]
): readonly string[] {
    const usedIds = new Set<string>();
    for (const destination of destinations) {
        // TYPE-WORKAROUND: `EntityItem` models only the fields the sitemap needs
        // from every entity (slug + updatedAt); the destination payload also
        // carries an embedded `attractions` relation this function reads.
        const embedded = (destination as unknown as { attractions?: readonly { id?: string }[] })
            .attractions;
        for (const attraction of embedded ?? []) {
            if (attraction?.id) usedIds.add(attraction.id);
        }
    }

    return attractions
        .filter((attraction) => {
            // TYPE-WORKAROUND: same as above — `id` is present on the attraction
            // payload but absent from the shared `EntityItem` shape.
            const id = (attraction as unknown as { id?: string }).id;
            return Boolean(id) && usedIds.has(id as string);
        })
        .map((attraction) => attraction.slug)
        .filter((slug): slug is string => Boolean(slug));
}

/**
 * Event category facet-landing slugs (SPEC-306 §4). Canonical Spanish slugs
 * (H-110) sourced from `EVENT_CATEGORY_SLUG_BY_ENUM`, the SAME map the
 * `pages/[lang]/eventos/categoria/[category]/index.astro` landing resolves
 * against — this can never drift from that page's accepted slugs.
 */
const EVENT_CATEGORY_SLUGS = Object.values(EVENT_CATEGORY_SLUG_BY_ENUM);

/**
 * Accommodation type facet-landing slugs (SPEC-306 §4). Canonical Spanish
 * slugs (H-110) sourced from `ACCOMMODATION_TYPE_SLUG_BY_ENUM`, the SAME map
 * `pages/[lang]/alojamientos/tipo/[type]/index.astro` resolves against — this
 * list can never drift from the enum OR from what that page accepts.
 */
const ACCOMMODATION_TYPE_SLUGS = Object.values(ACCOMMODATION_TYPE_SLUG_BY_ENUM);

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

    // Fetch all entity types in parallel. Individual failures degrade gracefully.
    // No `status` filter: the public list endpoints already return only public
    // (published) content, and they reject an unknown `status` query param with
    // HTTP 400 — which previously made every entity fetch fail and the sitemap
    // come back empty.
    const [
        accommodations,
        destinations,
        events,
        posts,
        gastronomy,
        experiences,
        attractions,
        pointsOfInterest,
        authors,
        partners
    ] = await Promise.allSettled([
        fetchAllEntities(apiUrl, `${base}/accommodations`),
        fetchAllEntities(apiUrl, `${base}/destinations`, { includeEventCount: 'true' }),
        fetchAllEntities(apiUrl, `${base}/events`),
        fetchAllEntities(apiUrl, `${base}/posts`),
        fetchAllEntities(apiUrl, `${base}/gastronomies`),
        fetchAllEntities(apiUrl, `${base}/experiences`),
        fetchAllEntities(apiUrl, `${base}/attractions`),
        fetchAllEntities(apiUrl, `${base}/points-of-interest`),
        // Authors is APPENDED, never inserted mid-array: the tests in
        // `test/pages/sitemap-dynamic.test.ts` stub `fetch` positionally with
        // `mockImplementationOnce`, so a new fetch anywhere above would shift
        // every later entity onto the wrong stub.
        fetchAllEntities(apiUrl, `${base}/authors`),
        // Partners (HOS-294) — appended for exactly the same reason.
        fetchAllEntities(apiUrl, `${base}/partners`)
    ]);

    const resolvedAccommodations =
        accommodations.status === 'fulfilled' ? accommodations.value : [];
    const resolvedDestinations = destinations.status === 'fulfilled' ? destinations.value : [];
    const resolvedEvents = events.status === 'fulfilled' ? events.value : [];
    const resolvedPosts = posts.status === 'fulfilled' ? posts.value : [];
    const resolvedGastronomy = gastronomy.status === 'fulfilled' ? gastronomy.value : [];
    const resolvedExperiences = experiences.status === 'fulfilled' ? experiences.value : [];
    const resolvedAttractions = attractions.status === 'fulfilled' ? attractions.value : [];
    const resolvedPointsOfInterest =
        pointsOfInterest.status === 'fulfilled' ? pointsOfInterest.value : [];
    const resolvedAuthors = authors.status === 'fulfilled' ? authors.value : [];
    const resolvedPartners = partners.status === 'fulfilled' ? partners.value : [];

    const entries: string[] = [];

    // ── Entity listing pages (priority 0.7) ──────────────────────────────
    // These belong here rather than in the static sitemap: their content is
    // the entity set fetched below, so they change whenever a row does.
    // Purely informational pages live in `/sitemap-static.xml` instead.
    const LISTING_PATHS = [
        'alojamientos',
        'destinos',
        'eventos',
        'gastronomia',
        'experiencias',
        'publicaciones'
    ] as const;

    const listingLastmod = new Date().toISOString().slice(0, 10);

    for (const listingPath of LISTING_PATHS) {
        entries.push(
            ...buildLocalizedUrlEntries({
                path: `/${listingPath}/`,
                siteUrl,
                lastmod: listingLastmod,
                changefreq: 'weekly',
                priority: 0.7
            })
        );
    }

    // ── Detail entity pages (priority 0.8) ───────────────────────────────

    // Accommodations: /alojamientos/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedAccommodations,
            siteUrl,
            pathFn: ENTITY_PUBLIC_PATHS.accommodation,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Destinations: /destinos/{slug}/ — exclude thin/empty destinations (no
    // accommodations, events, or attractions) so the sitemap matches the noindex
    // on the detail page (HOS-117 T-006). The list endpoint returns `attractions`
    // as an array and only includes `eventsCount` when asked (includeEventCount
    // above), so destinationListItemCounts bridges that shape to the shared
    // predicate — feeding it the same three counts the detail page uses.
    const indexableDestinations = resolvedDestinations.filter(
        (item) =>
            !isThinDestination(destinationListItemCounts(item as EntityItem & DestinationListItem))
    );
    entries.push(
        ...buildEntriesForEntity({
            items: indexableDestinations,
            siteUrl,
            pathFn: ENTITY_PUBLIC_PATHS.destination,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Events: /eventos/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedEvents,
            siteUrl,
            pathFn: ENTITY_PUBLIC_PATHS.event,
            changefreq: 'weekly',
            priority: 0.8
        })
    );

    // Posts: /publicaciones/{slug}/
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedPosts,
            siteUrl,
            pathFn: ENTITY_PUBLIC_PATHS.post,
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

    // Points of interest: /destinos/lugar/{slug}/ — ONLY the curated few that
    // carry `hasOwnPage`. The other ~839 catalog rows have no page (the route
    // 404s on them by design), so emitting them would advertise 404s; and were
    // they published, they would be doorway content restating their
    // destination's accommodation listing. See the page's own file header.
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedPointsOfInterest.filter(
                // TYPE-WORKAROUND: `EntityItem` models only the fields every
                // entity shares (slug + updatedAt); `hasOwnPage` is specific to
                // the point-of-interest payload, which this filter reads.
                (item) => (item as unknown as { hasOwnPage?: boolean }).hasOwnPage === true
            ),
            siteUrl,
            pathFn: (slug) => `/destinos/lugar/${slug}/`,
            changefreq: 'monthly',
            priority: 0.6
        })
    );

    // Authors: /autores/{slug}/ — NO filter here, deliberately. Every other
    // entity block decides indexability in this file, but the author predicate
    // (HOS-375 §6.5: not a system account, at least one published item, a bio,
    // an avatar) is already applied by `GET /api/v1/public/authors`, which
    // shares it with the page through `evaluateAuthorIndexability`. Re-deciding
    // it here would create the second source of truth §6.6 exists to prevent —
    // the failure it guards against is the sitemap advertising a URL the page
    // then serves as `noindex`.
    //
    // `lastmod` is the author row's own `updatedAt`, which the endpoint returns
    // for exactly this purpose: the page renders a profile plus two content
    // lists, so a profile edit really is a change to this URL.
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedAuthors,
            siteUrl,
            pathFn: (slug) => `/autores/${slug}/`,
            changefreq: 'weekly',
            priority: 0.6
        })
    );

    // Partners: /partners/{slug}/ — ONLY the gold ones that pass the shared
    // indexability predicate (HOS-294 D-3). `evaluatePartnerIndexability` is the
    // SAME function the page uses to decide its own `noindex`, which is the
    // whole point: deciding it a second time here is how a sitemap ends up
    // advertising a URL the page then serves `noindex`.
    //
    // Note this filter is NOT redundant with the API's own. The public LIST
    // returns every visible partner regardless of tier, because the home
    // carousel needs the silver ones too — and a silver partner has no page.
    entries.push(
        ...buildEntriesForEntity({
            items: resolvedPartners.filter(
                (item) =>
                    evaluatePartnerIndexability(
                        // TYPE-WORKAROUND: `EntityItem` models only what every
                        // entity shares (slug + updatedAt); these four fields are
                        // specific to the partner payload.
                        item as unknown as Parameters<typeof evaluatePartnerIndexability>[0]
                    ).isIndexable
            ),
            siteUrl,
            pathFn: (slug) => `/partners/${slug}/`,
            changefreq: 'monthly',
            priority: 0.6
        })
    );

    // Event category facet landings: /eventos/categoria/{slug}/ (SPEC-306, 9 URLs).
    entries.push(
        ...buildEntriesForStaticSlugs({
            slugs: EVENT_CATEGORY_SLUGS,
            siteUrl,
            pathFn: (slug) => `/eventos/categoria/${slug}/`,
            changefreq: 'monthly',
            priority: 0.7
        })
    );

    // Accommodation type facet landings: /alojamientos/tipo/{slug}/ (SPEC-306, 13 URLs).
    entries.push(
        ...buildEntriesForStaticSlugs({
            slugs: ACCOMMODATION_TYPE_SLUGS,
            siteUrl,
            pathFn: (slug) => `/alojamientos/tipo/${slug}/`,
            changefreq: 'monthly',
            priority: 0.7
        })
    );

    // Attraction facet landings: /destinos/atraccion/{slug}/ — only the ones a
    // destination actually offers, so no empty page is ever advertised.
    entries.push(
        ...buildEntriesForStaticSlugs({
            slugs: resolveUsedAttractionSlugs(resolvedAttractions, resolvedDestinations),
            siteUrl,
            pathFn: (slug) => `/destinos/atraccion/${slug}/`,
            changefreq: 'monthly',
            priority: 0.6
        })
    );

    return new Response(buildUrlsetDocument(entries), {
        status: 200,
        headers: getSitemapResponseHeaders()
    });
};
