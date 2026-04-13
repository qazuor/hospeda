/**
 * Sort phrase builder for the accommodation listing summary.
 *
 * Resolves an `AccommodationSort` into a human-readable phrase that can be
 * appended to the end of the summary sentence.
 */

import { DEFAULT_SORT_KEYS } from './summary.catalogs';
import type { AccommodationSort, SummaryCatalogs, SummaryLocale } from './summary.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for {@link buildSortPhrase}. */
export interface BuildSortPhraseInput {
    /** Active sort configuration, or null/undefined when no sort is applied. */
    readonly sort: AccommodationSort | null | undefined;
    /** Label catalogs. When `sortKeys` is absent, `DEFAULT_SORT_KEYS` is used. */
    readonly catalogs: SummaryCatalogs;
    /** Output locale. */
    readonly locale: SummaryLocale;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Builds the sort description phrase for the summary sentence.
 *
 * The phrase describes the active sort in the form:
 * - es: "ordenados por nombre, A a Z"
 * - en: "sorted by name, A to Z"
 *
 * When the sort key is not found in the catalog a generic fallback is used:
 * - es: "ordenados por {key}, asc" / "ordenados por {key}, desc"
 * - en: "sorted by {key}, asc" / "sorted by {key}, desc"
 *
 * Returns an empty string when `sort` is null or undefined.
 *
 * @param input - {@link BuildSortPhraseInput}
 * @returns Sort phrase string, or empty string when no sort is active
 *
 * @example
 * ```ts
 * buildSortPhrase({
 *   sort: { key: 'name', direction: 'asc' },
 *   catalogs: { sortKeys: DEFAULT_SORT_KEYS },
 *   locale: 'es'
 * })
 * // => 'ordenados por nombre, A a Z'
 *
 * buildSortPhrase({
 *   sort: { key: 'price', direction: 'desc' },
 *   catalogs: {},
 *   locale: 'en'
 * })
 * // => 'sorted by price, highest first'
 *
 * buildSortPhrase({ sort: null, catalogs: {}, locale: 'es' })
 * // => ''
 * ```
 */
export function buildSortPhrase({ sort, catalogs, locale }: BuildSortPhraseInput): string {
    if (!sort) return '';

    const sortedByPhrase = locale === 'es' ? 'ordenados por' : 'sorted by';

    // Look up sort key in catalog, falling back to defaults
    const sortKeys = catalogs.sortKeys ?? DEFAULT_SORT_KEYS;
    const entry = sortKeys.find((e) => e.key === sort.key);

    if (!entry) {
        // Generic fallback for unknown sort keys
        const directionLabel = sort.direction === 'asc' ? 'asc' : 'desc';
        return `${sortedByPhrase} ${sort.key}, ${directionLabel}`;
    }

    const label = entry.label[locale];
    const directionPhrase = sort.direction === 'asc' ? entry.asc[locale] : entry.desc[locale];

    return `${sortedByPhrase} ${label}, ${directionPhrase}`;
}
