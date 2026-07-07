/**
 * @file toggle-query-param.ts
 * @description Shared helper for building quick-filter chip hrefs that toggle
 * a single-select query param in place (`?key=value`) while preserving every
 * other active filter/sort param. Used by the eventos (`category`),
 * gastronomía (`type`), and experiencias (`type`) quick-filter chip rows
 * (HOS-97).
 *
 * "Toggle" semantics: clicking the chip for the currently active value
 * REMOVES the param (clears the filter); clicking any other value SETS the
 * param to that value (single-select, not multi-select — matches the
 * eventos `?category=` model). Always drops `page` so a filter change resets
 * pagination to page 1.
 */

interface BuildToggleParamHrefParams {
    /** Canonical listing base URL (trailing slash, no query string). */
    readonly baseUrl: string;
    /** Current URL search params — source of truth for every OTHER active filter/sort. */
    readonly searchParams: URLSearchParams;
    /** Query param key being toggled (e.g. `'category'`, `'type'`). */
    readonly key: string;
    /** Candidate value for this chip. */
    readonly value: string;
    /** Whether this chip's value is the currently active one. */
    readonly isActive: boolean;
}

/**
 * Build a quick-filter chip href that toggles a single-select query param in
 * place, preserving every other active param and resetting pagination.
 *
 * @param params - See {@link BuildToggleParamHrefParams}.
 * @returns The resulting href — `baseUrl` alone when no params remain.
 *
 * @example
 * ```ts
 * buildToggleParamHref({
 *   baseUrl: '/es/eventos/',
 *   searchParams: new URLSearchParams('q=asado&category=GASTRONOMY'),
 *   key: 'category',
 *   value: 'GASTRONOMY',
 *   isActive: true
 * });
 * // '/es/eventos/?q=asado' (category cleared, q preserved)
 * ```
 */
export function buildToggleParamHref({
    baseUrl,
    searchParams,
    key,
    value,
    isActive
}: BuildToggleParamHrefParams): string {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
    if (isActive) {
        params.delete(key);
    } else {
        params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
}
