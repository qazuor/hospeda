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
 *   - an indexable canonical view (base listing or a single-type landing), not
 *     a `noindex` facet combination; and
 *   - without arbitrary result-narrowing filters (which are low-repeat and
 *     would fill the CDN cache with single-hit entries).
 *
 * Filtered and `noindex` responses stay `private` and reach origin as before.
 *
 * WHAT MAKES THIS SAFE CHANGED IN WAVE B0 — do not re-derive it from the old
 * shape. This file used to describe a third condition, "anonymous, via the
 * `!isAuthenticated` gate at each call site", and called that gate the
 * load-bearing safety property. **That gate no longer exists**: as of Wave B0
 * none of the 37 `applyCacheHeaders` call sites under `src/pages` reads the
 * session, so a cacheable page emits `public` whether or not a session cookie is
 * present. That is correct, not a regression — the safety property moved rather
 * than disappeared. It is now AC-B0-1: the SSR HTML is identical with and
 * without a session, so there is no personalised response to mark shareable in
 * the first place. Verified end-to-end on staging (2026-08-08) by diffing two
 * real responses; see §9 AC-B0-1 in the spec.
 *
 * Two consequences worth stating, because reading `public` on a response that
 * carried a session cookie looks alarming until you know them:
 *
 *   - The guarantee is enforced, not assumed. `test/pages/
 *     cacheable-pages-are-session-blind.guard.test.ts` (WB0-6) is fail-closed:
 *     reintroducing a session read into a cacheable page fails it.
 *   - Per-user state is reconciled AFTER hydration, not baked into the HTML.
 *     `data-user-authenticated` ships as `"false"` and the client flips it; the
 *     favourites grid resolves through a single `check-bulk` call.
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
 * cache TAGS a write affects (HOS-369 W1-1 — it used to flush the whole zone on
 * any content write, which would have made this cache empty itself). The TTL
 * only bounds staleness in the case a purge is missed.
 *
 * THE TTL IS NO LONGER DECIDED HERE. This file used to own the site's single
 * `s-maxage` pair, which every cacheable page shared regardless of what could
 * change it. Since HOS-426 the budget comes from the page's cache CLASS
 * (`./cache-classes.ts`) and this file is back to what its name says: the
 * predicates deciding whether an accommodation listing response is shareable at
 * all. What remains here is `LISTING_PRIVATE_CONTROL`, the demotion value,
 * which is a cacheability answer rather than a TTL.
 *
 * Which tags a response carries is declared through `applyCacheHeaders`
 * (`./response-cache.ts`) — the only thing that may mark a response cacheable,
 * and which cannot do so without them.
 */

/** `Cache-Control` value for a per-user / non-shareable listing response. */
export const LISTING_PRIVATE_CONTROL = 'private, no-cache';

/**
 * Default children context value. A value away from this DOES narrow the
 * result set (it feeds the derived `minGuests`), unlike the other purely
 * informational context params, so it counts as an active filter.
 *
 * `adults` has no equivalent default: since BETA-161, the absence of the
 * `adults` param is the only non-filtering state — ANY explicit `adults`
 * value (including what used to be the invisible default of 2) is now a
 * real, active filter. See {@link hasActiveAccommodationListingFilters}.
 */
const DEFAULT_CHILDREN = 0;

/**
 * Query params that do NOT change which accommodations are shown, so their mere
 * presence does not make a response "filtered":
 *   - `page` / `sortBy` / `sortOrder`: pagination and ordering (bounded set of
 *     variants, all serving the same underlying result set);
 *   - `type` / `types`: the accommodation-type facet, handled separately per
 *     page (via the `noindex` SEO decision on the base listing, or fixed by the
 *     URL path on the dedicated `/tipo/{slug}/` landing).
 * `adults` / `children` are handled explicitly below (any explicit `adults`
 * value is a filter; `children` is a filter only away from its 0 default).
 *
 * **`checkIn` / `checkOut` used to be listed here**, described as
 * "informational trip context (no real-time availability filtering yet)". That
 * was accurate for as long as the listing pages read the dates and never
 * forwarded them. Since H-120 the pair IS forwarded and DOES narrow the result
 * set, so leaving them here would mark a date-filtered response `public` and
 * let Cloudflare serve one visitor's availability results to a visitor asking
 * for entirely different dates. Removing them is part of that fix, not an
 * unrelated tightening — wiring the filter without this change would have
 * traded a missing filter for a wrong one.
 */
const NON_FILTERING_PARAMS: ReadonlySet<string> = new Set([
    'page',
    'sortBy',
    'sortOrder',
    'type',
    'types'
]);

/**
 * Whether any result-narrowing filter is active on an accommodation listing
 * URL — the signal that makes a response non-shareable (an arbitrary, low-repeat
 * combination we don't want to fill the CDN cache with).
 *
 * Returns `true` when any query param outside {@link NON_FILTERING_PARAMS} is
 * present, when `adults` is explicitly set (any value — see BETA-161), or when
 * `children` is away from its 0 default (both feed the derived `minGuests` and
 * DO narrow results even though they read as "context"). Returns `false` for a
 * bare URL or one carrying only pagination/sort/context params — i.e. the base
 * listing, single-type landing, and their bounded pagination/sort variants.
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
    if (adults !== null) {
        return true;
    }
    const children = searchParams.get('children');
    if (children !== null && Number(children) !== DEFAULT_CHILDREN) {
        return true;
    }

    return false;
}

/**
 * Whether a listing URL carries nothing but pagination — the signal that it is
 * the plain, unfiltered listing, possibly at page N.
 *
 * This exists because `/…/page/N/` is not what the listing page actually sees.
 * Those routes are `Astro.rewrite`s into the parent listing with `?page=N`
 * appended, so a naive `Astro.url.search === ''` check would mark every
 * paginated page non-cacheable while looking correct on page 1 — the kind of
 * regression that shows up as a cache-hit-rate number nobody is watching
 * rather than as a broken page.
 *
 * The accommodation listing does not use this: it has its own richer predicate
 * ({@link hasActiveAccommodationListingFilters}) covering sort and trip-context
 * params it additionally accepts. This is the conservative default for the
 * catalog listings that accept no facets of their own (HOS-369 W2-3), where
 * anything other than `page` should keep the response private.
 *
 * @param params.searchParams - The request URL's search params.
 * @returns `true` when the only params present (if any) are pagination.
 */
export function hasOnlyPaginationParams({
    searchParams
}: {
    readonly searchParams: URLSearchParams;
}): boolean {
    for (const key of searchParams.keys()) {
        if (key !== 'page') return false;
    }
    return true;
}
