/**
 * @file facet-crawl-policy.ts
 * @description Single source of truth for **which query params turn a page URL
 * into a filtered facet view**, and therefore which links must not be followed
 * and which URLs must not be crawled (HOS-369 WA-1 / WA-2).
 *
 * Why this exists: the listing pages and the destination detail page publish a
 * *combinatorial* URL space. Every facet chip href adds one more value to a
 * cumulative param (`?categories=a`, `?categories=a,b`, ...), so a crawler that
 * follows chips depth-first walks an exponential tree of URLs, all of which
 * re-render the same content on an origin that caches nothing. Measured on
 * 2026-07-30: 464k requests / 83.7 GB of egress in 24 h against 381 sitemap
 * URLs (see `.specs/HOS-369-web-performance-edge-cache/spec.md` §5.9).
 *
 * Two mechanisms consume this module, and both are needed because they cover
 * different gaps:
 *
 * 1. **`robots.txt`** (`src/pages/robots.txt.ts`) — governs *fetching*. Emits a
 *    `Disallow: /*?*<key>=` directive per key below.
 * 2. **`rel="nofollow"`** (`shouldNofollowFacetHref`) — governs *link-graph
 *    discovery*. A crawler that already has a filtered URL queued will still
 *    request it regardless of `robots.txt` arriving later.
 *
 * **Deliberately NOT a blanket `Disallow: /*?*`** (spec R-8): the path-based
 * facet landings (`/alojamientos/tipo/{slug}/`, `/eventos/categoria/{slug}/`,
 * `/publicaciones/categoria/{slug}/`) are indexable SEO surface from HOS-96 and
 * carry no query string at all, so a key-scoped rule leaves them crawlable by
 * construction. Blocking them would be silent damage that takes weeks to
 * surface in Search Console.
 *
 * **Why blocking these costs no indexable surface**: every URL carrying one of
 * these params either self-canonicalizes to the clean listing or canonicalizes
 * to its dedicated path-based landing (`resolveFacetSeoDecision`,
 * `src/lib/seo/promoted-facet-canonical.ts`); 2+ active values are already
 * `noindex,follow`. Nothing here was ever meant to rank on its own.
 */

/**
 * Every query param that marks a URL as a filtered/refined view of a listing.
 *
 * Grouped by origin, all flattened into one list because both consumers treat
 * them identically. `page` is intentionally ABSENT: pagination is legitimate
 * discovery surface, and the repo's own pagination is path-based
 * (`/alojamientos/page/2/`) anyway.
 */
export const FACET_QUERY_PARAM_KEYS: readonly string[] = Object.freeze([
    // --- Multi-select quick-filter facets (HOS-96, HOS-147) -----------------
    // The combinatorial core: these are the params the chip rows accumulate
    // into, and the ones the destination detail page emitted 35 links for.
    'categories',
    'category',
    'types',
    'type',
    'attractions',

    // --- Listing sidebar refinements ---------------------------------------
    'amenities',
    'features',
    'minPrice',
    'maxPrice',
    'priceRange',
    'minRating',
    'minBedrooms',
    'minBathrooms',
    'hasWifi',
    'hasPool',
    'hasParking',
    'allowsPets',
    'isFeatured',
    'isFree',
    'includeNoPrice',
    'includeNoReviews',
    'includeUnpriced',

    // --- Date / occupancy (unbounded value space — the worst offenders) ------
    'checkIn',
    'checkOut',
    'adults',
    'children',
    'when',
    'startDateAfter',
    'startDateBefore',
    'publishedAfter',
    'publishedBefore',

    // --- Geo / proximity ----------------------------------------------------
    'latitude',
    'longitude',
    'radius',
    'poiId',
    'poiSlug',
    'destinationId',
    'destinationIds',

    // --- Sort permutations + internal search results -------------------------
    // `sortBy` multiplies every other combination by the number of sort keys.
    // `q` is an internal search-results param: unbounded, and blocking it is
    // long-standing search-engine guidance.
    'sortBy',
    'q'
]);

interface ShouldNofollowFacetHrefParams {
    /** The candidate link target — absolute path, relative, or query-only (`?types=HOTEL`). */
    readonly href: string;
}

/**
 * Decide whether a link href points at a filtered facet view and must therefore
 * carry `rel="nofollow"`.
 *
 * Derived from the href itself rather than passed in per call site on purpose:
 * `FilterChips.astro` is shared by consumers that link BOTH query-param facet
 * views and path-based facet landings, and a per-caller `nofollow` prop is a
 * gate that some of the six call sites would eventually forget. Reading the
 * href makes the rule impossible to skip and keeps the landings followable.
 *
 * @param params - See {@link ShouldNofollowFacetHrefParams}.
 * @returns `true` when the href's query string carries any
 *   {@link FACET_QUERY_PARAM_KEYS} member; `false` otherwise (including for
 *   query-less hrefs — a chip that CLEARS the last active value links the clean
 *   listing URL and must stay followable).
 *
 * @example
 * ```ts
 * shouldNofollowFacetHref({ href: '/es/alojamientos/?types=HOTEL' }); // true
 * shouldNofollowFacetHref({ href: '/es/alojamientos/tipo/hotel/' }); // false
 * ```
 */
export function shouldNofollowFacetHref({ href }: ShouldNofollowFacetHrefParams): boolean {
    const queryStart = href.indexOf('?');
    if (queryStart === -1) return false;

    // Strip any fragment first — destinos appends `#dest-filter-top` to every
    // filter href, and a fragment must never be parsed as part of the query.
    const hashStart = href.indexOf('#', queryStart);
    const query =
        hashStart === -1 ? href.slice(queryStart + 1) : href.slice(queryStart + 1, hashStart);
    if (query.length === 0) return false;

    const params = new URLSearchParams(query);
    return FACET_QUERY_PARAM_KEYS.some((key) => params.has(key));
}

/**
 * Build the `robots.txt` `Disallow` directives that block every facet query
 * param, for inclusion in a single `User-agent` block.
 *
 * Pattern shape: `/*?*<key>=`. The leading `/*` matches any path, `?` anchors
 * the query string, and the second `*` covers the param appearing in any
 * position (`?key=`, `?other=1&key=`) — so one directive per key replaces the
 * `?`-and-`&` pair a literal-prefix rule would need. `*` and `$` are the two
 * wildcards standardized by RFC 9309, so this is portable across compliant
 * crawlers.
 *
 * @returns One `Disallow: ...` line per {@link FACET_QUERY_PARAM_KEYS} member,
 *   in declaration order.
 */
export function buildFacetDisallowDirectives(): readonly string[] {
    return FACET_QUERY_PARAM_KEYS.map((key) => `Disallow: /*?*${key}=`);
}
