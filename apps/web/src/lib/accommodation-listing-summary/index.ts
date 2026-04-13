/**
 * Accommodation listing summary builder — public API.
 *
 * Transforms applied filters, counts, and sort options into human-readable
 * Spanish or English summary phrases for accommodation listing pages.
 *
 * @example
 * ```ts
 * import { buildAccommodationListingSummary } from './accommodation-listing-summary';
 *
 * const summary = buildAccommodationListingSummary({
 *   locale: 'es',
 *   filters: { types: ['HOTEL'], destinations: ['colon'] },
 *   counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
 *   catalogs: {
 *     destinations: [{ key: 'colon', label: { es: 'Colón', en: 'Colón' } }],
 *   },
 * });
 * // => 'Mostrando 18 de 42 hoteles en Colón.'
 * ```
 */

// Main builder
export { buildAccommodationListingSummary } from './summary.builder';

// Legacy adapter
export { mapLegacyFiltersToSummaryFilters } from './summary.legacy';
export type { LegacyFilter, MapLegacyFiltersInput } from './summary.legacy';

// Catalog defaults (consumers may extend these)
export { DEFAULT_SORT_KEYS, DEFAULT_TYPE_GRAMMAR } from './summary.catalogs';

// Subject resolution (exported for advanced use)
export type { ResolvedSubject, ResolveSubjectInput } from './summary.subject';

// All public types
export type {
    AccommodationSort,
    AccommodationSummaryFilters,
    BuildAccommodationListingSummaryInput,
    CatalogEntry,
    FilterDescriptor,
    FilterDescriptorContext,
    MatchMode,
    QuantityMode,
    SortDirection,
    SortKeyEntry,
    SortType,
    SummaryCatalogs,
    SummaryCounts,
    SummaryLocale,
    SummaryOptions,
    TypeGrammarEntry
} from './summary.types';
