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
 */

interface ReadFacetActiveValuesParams {
    /** Current URL search params — source of truth for active filter state. */
    readonly searchParams: URLSearchParams;
    /** Array query param key to read (e.g. `'types'`, `'categories'`). */
    readonly paramKey: string;
}

/**
 * Read the current de-duplicated, order-preserving list of active values for
 * a multi-select facet's array query param.
 *
 * @param params - See {@link ReadFacetActiveValuesParams}.
 * @returns Unique active values in first-seen order (empty array when absent).
 *
 * @example
 * ```ts
 * readFacetActiveValues({
 *   searchParams: new URLSearchParams('types=HOTEL,CABIN'),
 *   paramKey: 'types'
 * });
 * // ['HOTEL', 'CABIN']
 * ```
 */
export function readFacetActiveValues({
    searchParams,
    paramKey
}: ReadFacetActiveValuesParams): readonly string[] {
    const raw = searchParams
        .getAll(paramKey)
        .flatMap((entry) => entry.split(','))
        .map((member) => member.trim())
        .filter((member) => member.length > 0);
    return [...new Set(raw)];
}
