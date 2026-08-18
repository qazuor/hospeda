/**
 * @file canonical-facet-order.ts
 * @description The single ordering rule for every multi-select facet CSV query
 * param (`?types=`, `?categories=`, `?attractions=`) — HOS-524.
 *
 * Why this exists: `buildMultiToggleParamHref` used to serialize a facet's
 * values in CLICK order, so `?types=HOTEL,CABIN` and `?types=CABIN,HOTEL` were
 * two different URLs serving identical content. That turned the reachable URL
 * space from the SUBSETS of the facet's values into their PERMUTATIONS — of the
 * order of 10^10 URLs for the 13 accommodation types, all of them uncacheable
 * at the edge (a listing with a query string is `DYNAMIC` by design, so every
 * hit reaches the origin and the database). Meta's `meta-webindexer` walked that
 * space on 2026-08-12 at ~3 req/s: 104.997 requests in 24 h, 88% of the site's
 * whole traffic, 99,98% of it bypassing Cloudflare.
 *
 * Collapsing permutations onto one canonical serialization is half the fix; the
 * other half is the depth cap in `facet-chip-depth.ts`, which bounds the number
 * of subsets a chip row is willing to link at all.
 *
 * **The order is lexicographic (UTF-16 code units), NOT locale-aware.** A
 * locale-aware comparator (`localeCompare`) would order the same values
 * differently across runtimes and locales, which is exactly the property this
 * module exists to remove: the SSR render, the sidebar island, and the
 * destinos page must all produce byte-identical URLs for the same selection, or
 * the crawl space (and the edge cache) fragments again. It also has to work for
 * values that are not enum members at all — POI category slugs and destination
 * attraction UUIDs — where no declared order exists to follow.
 */

interface CanonicalizeFacetValuesParams {
    /** The facet's active values, in whatever order the caller collected them. */
    readonly values: readonly string[];
}

/**
 * Normalize a facet's active values to their canonical serialization order:
 * de-duplicated and lexicographically sorted.
 *
 * Every writer of a facet CSV param MUST route through this — the chip href
 * builder, the `FilterSidebar` reducer, and the destinos badge builder alike.
 * A writer that skips it re-opens the permutation space for its own facet, and
 * desynchronizes its URLs from the other writers' for the same selection.
 *
 * @param params - See {@link CanonicalizeFacetValuesParams}.
 * @returns The unique values in canonical order. Never mutates the input.
 *
 * @example
 * ```ts
 * canonicalizeFacetValues({ values: ['HOTEL', 'CABIN', 'HOTEL'] });
 * // ['CABIN', 'HOTEL'] — one URL per selection, regardless of click order
 * ```
 */
export function canonicalizeFacetValues({
    values
}: CanonicalizeFacetValuesParams): readonly string[] {
    return [...new Set(values)].sort();
}
