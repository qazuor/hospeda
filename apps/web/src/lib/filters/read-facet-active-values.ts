/**
 * @file read-facet-active-values.ts
 * @description Shared helper reading a multi-select facet's currently active
 * values from the URL's array query param (HOS-96 T-009). Quick-filter chip
 * rows use it to compute each chip's `active` / `aria-pressed` state from the
 * facet's declared `paramKey` (see `facet-config.ts`) — the URL is the single
 * shared source of truth for active filter state across chips, the sidebar,
 * and back/forward navigation (spec US-5).
 *
 * Tolerant of both CSV (`?types=HOTEL,CABIN`) and repeated-key
 * (`?types=HOTEL&types=CABIN`) encodings, trims whitespace, and de-duplicates
 * (preserving first-seen order) — mirroring the reading logic already used by
 * `buildMultiToggleParamHref` (`toggle-multi-query-param.ts`).
 *
 * HOS-96 pre-merge review (Option A, owner-approved): optionally accepts the
 * facet's legacy `singularParamKey` (see `facet-config.ts`). When the plural
 * array param yields zero values, this falls back to reading the singular
 * param the SAME tolerant way — mirroring the backend's own precedence
 * (`if (categories) ... else if (category) ...`, see `AccommodationModel` /
 * `EventModel` / `PostModel`). This closes a gap where an old shared link
 * using only the singular param (`?category=MUSIC`, `?type=HOTEL`) still
 * filtered the grid (the singular value was already forwarded to the API
 * separately) but lost its dedicated-landing SEO canonical and didn't
 * highlight the matching chip/sidebar checkbox, because those all read
 * ONLY the plural param before this fix.
 */

interface ReadFacetActiveValuesParams {
    /** Current URL search params — source of truth for active filter state. */
    readonly searchParams: URLSearchParams;
    /** Array query param key to read (e.g. `'types'`, `'categories'`). */
    readonly paramKey: string;
    /**
     * The facet's legacy scalar query param (e.g. `'type'`, `'category'`),
     * consulted ONLY when `paramKey` yields zero values. Omit for facets
     * with no singular param (e.g. destinos' `attractions`), or when the
     * caller doesn't need the fallback — existing behavior is unchanged
     * when this is omitted.
     */
    readonly singularParamKey?: string;
}

/** Parse one query param the shared tolerant way: CSV split, trim, filter empties, dedup. */
function parseParamValues(searchParams: URLSearchParams, key: string): readonly string[] {
    const raw = searchParams
        .getAll(key)
        .flatMap((entry) => entry.split(','))
        .map((member) => member.trim())
        .filter((member) => member.length > 0);
    return [...new Set(raw)];
}

/**
 * Read the current de-duplicated, order-preserving list of active values for
 * a multi-select facet's array query param. When `singularParamKey` is
 * provided and the plural param is absent/empty, falls back to reading the
 * singular param instead — the plural param always wins when it has any
 * value.
 *
 * @param params - See {@link ReadFacetActiveValuesParams}.
 * @returns Unique active values in first-seen order (empty array when both
 *   the plural param and, if provided, the singular fallback are absent).
 *
 * @example
 * ```ts
 * readFacetActiveValues({
 *   searchParams: new URLSearchParams('types=HOTEL,CABIN'),
 *   paramKey: 'types'
 * });
 * // ['HOTEL', 'CABIN']
 *
 * readFacetActiveValues({
 *   searchParams: new URLSearchParams('type=HOTEL'),
 *   paramKey: 'types',
 *   singularParamKey: 'type'
 * });
 * // ['HOTEL'] — plural absent, falls back to the singular param
 * ```
 */
export function readFacetActiveValues({
    searchParams,
    paramKey,
    singularParamKey
}: ReadFacetActiveValuesParams): readonly string[] {
    const pluralValues = parseParamValues(searchParams, paramKey);
    if (pluralValues.length > 0) {
        return pluralValues;
    }
    if (singularParamKey) {
        return parseParamValues(searchParams, singularParamKey);
    }
    return [];
}
