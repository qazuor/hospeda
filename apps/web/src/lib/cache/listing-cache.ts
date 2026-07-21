/**
 * @file cache/listing-cache.ts
 * @description Cloudflare edge-cache policy for the accommodation listing/map
 * SSR pages (HOS-218).
 *
 * In production these pages served `cf-cache-status: DYNAMIC` — they emitted no
 * `Cache-Control` header, so Cloudflare forwarded EVERY request to origin and
 * each render re-fetched the full, near-static catalog (accommodations +
 * amenities + features + destinations) via the frontmatter `Promise.all`.
 * Sustained anonymous/bot traffic on `/alojamientos/` and `/alojamientos/mapa/`
 * (distinct visitor ids, ~dozens/sec) turned that into a flood of origin
 * catalog fetches — the `GET /public/features` volume HOS-218 flagged (it was
 * misattributed to the property editor, which fetches the catalog exactly once
 * server-side per load and never loops).
 *
 * The fix mirrors the pricing pages' proven pattern
 * (`suscriptores/planes|turistas/*`): emit
 * `Cache-Control: public, s-maxage, stale-while-revalidate` on the SSR response
 * so Cloudflare edge-caches the HTML — but ONLY for responses that are safe to
 * share from a single cache entry:
 *
 *   - anonymous (no per-user favourite state / compare controls baked into the
 *     SSR HTML — see the `!isAuthenticated` gate at each call site); and
 *   - an indexable canonical view (base listing or a single-type landing), not
 *     a `noindex` facet combination; and
 *   - without arbitrary result-narrowing filters (which are low-repeat and
 *     would fill the CDN cache with single-hit entries).
 *
 * Personalised, filtered, or `noindex` responses stay `private` and reach
 * origin as before. Gating on the anonymous case is the load-bearing safety
 * property: the origin never MARKS a personalised (favourite-baked) response as
 * shareable.
 *
 * IMPORTANT — this header is necessary but not sufficient. The origin cannot
 * control Cloudflare's cache-key. For this to take effect a Cloudflare Cache
 * Rule for `/alojamientos*` must (1) make the path eligible for edge caching
 * (respect the origin `Cache-Control`) and (2) BYPASS the cache when the Better
 * Auth session cookie is present. Without (2), an authenticated visitor could
 * be served a cached anonymous copy (guest-mode favourite/compare UI, since
 * `FavoriteButton`'s hydration self-correction is gated on the baked
 * `isAuthenticated` prop and never fires when that prop is `false`). As of this
 * change the prod zone still serves these HTML responses as
 * `cf-cache-status: DYNAMIC` — the origin `s-maxage` is inert until such a rule
 * exists (the sibling pricing pages already ship the same header and are
 * likewise `DYNAMIC` today), so this change causes no authenticated regression
 * on its own; it is the origin-side prerequisite for the Cache Rule.
 *
 * On-demand freshness is handled by `POST /api/revalidate`, which purges the
 * entire Cloudflare cache on any content write, so the TTL below only bounds
 * staleness in the (rare) case a purge is missed.
 */

/** `s-maxage` in seconds — how long Cloudflare serves the cached HTML. */
export const LISTING_CACHE_S_MAXAGE_SECONDS = 300;

/** `stale-while-revalidate` window in seconds. */
export const LISTING_CACHE_SWR_SECONDS = 600;

/** `Cache-Control` value for a shareable, edge-cacheable listing response. */
export const LISTING_CACHEABLE_CONTROL = `public, s-maxage=${LISTING_CACHE_S_MAXAGE_SECONDS}, stale-while-revalidate=${LISTING_CACHE_SWR_SECONDS}`;

/** `Cache-Control` value for a per-user / non-shareable listing response. */
export const LISTING_PRIVATE_CONTROL = 'private, no-cache';

/**
 * Resolve the `Cache-Control` header value for an accommodation listing/map
 * SSR response.
 *
 * @param params.cacheable - Whether this specific response is safe to share
 *   from the Cloudflare edge (anonymous, indexable, unfiltered).
 * @returns The header value to set via `Astro.response.headers.set`.
 */
export function resolveListingCacheControl({ cacheable }: { readonly cacheable: boolean }): string {
    return cacheable ? LISTING_CACHEABLE_CONTROL : LISTING_PRIVATE_CONTROL;
}

/**
 * Default party-size context values. A value away from these DOES narrow the
 * result set (both feed the derived `minGuests`), unlike the other purely
 * informational context params, so it counts as an active filter.
 */
const DEFAULT_ADULTS = 2;
const DEFAULT_CHILDREN = 0;

/**
 * Query params that do NOT change which accommodations are shown, so their mere
 * presence does not make a response "filtered":
 *   - `page` / `sortBy` / `sortOrder`: pagination and ordering (bounded set of
 *     variants, all serving the same underlying result set);
 *   - `checkIn` / `checkOut`: informational trip context (no real-time
 *     availability filtering yet);
 *   - `type` / `types`: the accommodation-type facet, handled separately per
 *     page (via the `noindex` SEO decision on the base listing, or fixed by the
 *     URL path on the dedicated `/tipo/{slug}/` landing).
 * `adults` / `children` are handled explicitly below (default vs. non-default).
 */
const NON_FILTERING_PARAMS: ReadonlySet<string> = new Set([
    'page',
    'sortBy',
    'sortOrder',
    'checkIn',
    'checkOut',
    'type',
    'types'
]);

/**
 * Whether any result-narrowing filter is active on an accommodation listing
 * URL — the signal that makes a response non-shareable (an arbitrary, low-repeat
 * combination we don't want to fill the CDN cache with).
 *
 * Returns `true` when any query param outside {@link NON_FILTERING_PARAMS} is
 * present, or when the party-size steppers are away from their defaults (those
 * feed the derived `minGuests` and DO narrow results even though they read as
 * "context"). Returns `false` for a bare URL or one carrying only
 * pagination/sort/context params — i.e. the base listing, single-type landing,
 * and their bounded pagination/sort variants.
 *
 * @param params.searchParams - The request URL's search params.
 * @returns `true` when at least one real filter is active.
 */
export function hasActiveAccommodationListingFilters({
    searchParams
}: {
    readonly searchParams: URLSearchParams;
}): boolean {
    for (const key of searchParams.keys()) {
        if (key === 'adults' || key === 'children') continue;
        if (!NON_FILTERING_PARAMS.has(key)) {
            return true;
        }
    }

    const adults = searchParams.get('adults');
    if (adults !== null && Number(adults) !== DEFAULT_ADULTS) {
        return true;
    }
    const children = searchParams.get('children');
    if (children !== null && Number(children) !== DEFAULT_CHILDREN) {
        return true;
    }

    return false;
}
