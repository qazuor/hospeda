/**
 * Single-facet canonical resolution (SPEC-306 OQ-3).
 *
 * A facet promoted to a first-class landing (event category, accommodation
 * type) should have its main-listing query-param form (`?category=music`,
 * `?types=HOTEL`) canonicalize to that landing's path — but ONLY when the
 * promoted facet is the sole active filter. Any additional filter active
 * alongside it falls back to the base-listing canonical (OQ-3's
 * "combinations canonicalize to base" rule), since a combination is not the
 * single indexable concept the landing represents.
 */

/**
 * Pure helper: decide whether the active facet values resolve to a single
 * promoted-landing slug, or should fall back to the base listing.
 *
 * @param facetValues - Active values for the promoted facet from the current
 *   URL (e.g. `['HOTEL']`, or `[]` when absent). More than one value means
 *   the user combined multiple values of the SAME facet (e.g. two types),
 *   which also falls back to the base listing — a landing represents one
 *   value, not a union.
 * @param hasOtherFilters - Whether any OTHER (non-promoted-facet) filter is
 *   also active (search, destination, price, amenities, dates, etc.).
 * @param validEnumValues - The facet's canonical enum values, used to reject
 *   an unrecognized/malformed value rather than build a link to a 404.
 * @returns The single promoted value to canonicalize to, or `undefined` when
 *   the base-listing canonical should be used instead.
 */
export function resolvePromotedFacetCanonical({
    facetValues,
    hasOtherFilters,
    validEnumValues
}: {
    readonly facetValues: readonly string[];
    readonly hasOtherFilters: boolean;
    readonly validEnumValues: readonly string[];
}): string | undefined {
    if (facetValues.length !== 1 || hasOtherFilters) {
        return undefined;
    }
    const [value] = facetValues;
    return value !== undefined && validEnumValues.includes(value) ? value : undefined;
}
