/**
 * @file toggle-multi-query-param.ts
 * @description Shared helper for building quick-filter chip hrefs that toggle a
 * value inside a **multi-select** CSV array query param (`?types=HOTEL,CABIN`)
 * in place, while preserving every other active filter/sort param. Sibling to
 * {@link buildToggleParamHref} (single-select) — used by the multi-select
 * quick-filter chip rows for accommodations (`types`), events (`categories`),
 * and blog (`categories`) (HOS-96).
 *
 * "Multi-toggle" semantics: clicking the chip for a value NOT currently present
 * appends it to the param (or sets the param if it was absent); clicking the
 * chip for a value already present removes just that value; removing the last
 * remaining value drops the param entirely (no empty `?key=` left behind).
 * Always drops `page` so a filter change resets pagination to page 1.
 *
 * Reading is tolerant of both URL encodings of an array param — CSV
 * (`?types=HOTEL,CABIN`) and repeated keys (`?types=HOTEL&types=CABIN`) — and
 * trims whitespace around members (via {@link readFacetActiveValues}, the
 * shared reader). The resulting param is normalized to a single de-duplicated
 * CSV param, preserving first-seen order (resolved OQ-4).
 *
 * HOS-96 pre-merge review (Option A, owner-approved): optionally accepts the
 * facet's legacy `singularKey` (e.g. `'category'`, `'type'`). When provided,
 * (1) the CURRENT values are seeded via {@link readFacetActiveValues}'s own
 * singular fallback, so toggling on an old `?category=MUSIC` URL correctly
 * starts from `['MUSIC']` before adding/removing the clicked value; (2) the
 * WRITE always deletes the singular param too (in addition to `page` and the
 * plural `key`), migrating the URL from singular to plural on first
 * interaction — no stale `?category=` left dangling next to the new
 * `?categories=`.
 */

import { readFacetActiveValues } from './read-facet-active-values';

interface BuildMultiToggleParamHrefParams {
    /** Canonical listing base URL (trailing slash, no query string). */
    readonly baseUrl: string;
    /** Current URL search params — source of truth for every OTHER active filter/sort. */
    readonly searchParams: URLSearchParams;
    /** Array query param key being toggled (e.g. `'types'`, `'categories'`). */
    readonly key: string;
    /** Candidate value for this chip (added if absent, removed if present). */
    readonly value: string;
    /**
     * The facet's legacy scalar query param (e.g. `'type'`, `'category'`).
     * When provided, seeds the current values from it if `key` is absent, and
     * is always deleted on write (migrating singular -> plural). Omit for
     * facets with no singular param, or to keep the existing behavior.
     */
    readonly singularKey?: string;
}

/**
 * Build a quick-filter chip href that toggles a value inside a multi-select CSV
 * array query param, preserving every other active param and resetting
 * pagination.
 *
 * @param params - See {@link BuildMultiToggleParamHrefParams}.
 * @returns The resulting href — `baseUrl` alone when no params remain.
 *
 * @example
 * ```ts
 * buildMultiToggleParamHref({
 *   baseUrl: '/es/alojamientos/',
 *   searchParams: new URLSearchParams('types=HOTEL'),
 *   key: 'types',
 *   value: 'CABIN'
 * });
 * // '/es/alojamientos/?types=HOTEL%2CCABIN' (CABIN appended, HOTEL preserved)
 * ```
 */
export function buildMultiToggleParamHref({
    baseUrl,
    searchParams,
    key,
    value,
    singularKey
}: BuildMultiToggleParamHrefParams): string {
    const current = readFacetActiveValues({
        searchParams,
        paramKey: key,
        singularParamKey: singularKey
    });
    const next = current.includes(value)
        ? current.filter((member) => member !== value)
        : [...current, value];

    const params = new URLSearchParams(searchParams);
    params.delete('page');
    params.delete(key);
    if (singularKey) {
        params.delete(singularKey);
    }
    if (next.length > 0) {
        params.set(key, next.join(','));
    }

    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
}
