/**
 * @file match-poi-category-filter.ts
 * @description Shared client-side predicate for the HOS-147 thematic POI
 * filter. Given a POI's full set of category slugs and the currently active
 * selection, decides whether the POI should be shown.
 *
 * This is the single source of truth for the filter's OR / any-of semantics
 * (spec D-1): a POI matches when it belongs to ANY selected category. It is
 * used by every surface that filters the same loaded POI list in sync — the
 * SSR card grid, the map's PRIMARY markers, and the map's client-fetched
 * NEARBY markers (spec R-3) — so the rule lives in exactly one place.
 *
 * An empty selection means "no filter active" and matches every POI, so the
 * unfiltered destination page shows all POIs (and the SSR HTML stays the full
 * indexable set, spec AC-8).
 */

/** Input for {@link matchesActivePoiCategories}. */
export interface MatchesActivePoiCategoriesParams {
    /**
     * The POI's full set of category slugs (every `r_poi_category` row, not
     * just its primary), as delivered by the destination POI payload's
     * `categories[]` field.
     */
    readonly poiCategorySlugs: readonly string[];
    /**
     * The currently active category slugs from the URL `?categories=` param
     * (already parsed via `readFacetActiveValues`). Empty = no filter active.
     */
    readonly activeCategorySlugs: readonly string[];
}

/**
 * Returns `true` when the POI should be visible under the current thematic
 * category selection, using OR / any-of semantics.
 *
 * @param params - {@link MatchesActivePoiCategoriesParams}.
 * @returns `true` if no filter is active, or the POI belongs to at least one
 *   of the active categories; `false` otherwise.
 */
export function matchesActivePoiCategories({
    poiCategorySlugs,
    activeCategorySlugs
}: MatchesActivePoiCategoriesParams): boolean {
    if (activeCategorySlugs.length === 0) {
        return true;
    }
    const active = new Set(activeCategorySlugs);
    return poiCategorySlugs.some((slug) => active.has(slug));
}
