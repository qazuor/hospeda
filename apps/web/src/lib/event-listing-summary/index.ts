/**
 * Event listing summary builder — public API.
 *
 * Mirrors `accommodation-listing-summary` but with the event-specific filter
 * shape (text, category, destinationId, date bounds, isFree, price range,
 * includeUnpriced, isFeatured, temporal chip).
 *
 * @example
 * ```ts
 * import { buildEventListingSummary, DEFAULT_EVENT_CATEGORIES } from './event-listing-summary';
 *
 * const summary = buildEventListingSummary({
 *     locale: 'es',
 *     filters: { category: 'MUSIC', destinationId: 'colon-id', isFree: true },
 *     counts: { shown: 3, total: 4 },
 *     sort: { sortKey: 'upcoming' },
 *     catalogs: {
 *         destinations: [{ key: 'colon-id', label: { es: 'Colón', en: 'Colón' } }],
 *         categories: DEFAULT_EVENT_CATEGORIES
 *     }
 * });
 * // => 'Mostrando 3 de 4 eventos en Colón de música, gratuitos, ordenados por fecha más próxima.'
 * ```
 */

export { buildEventListingSummary } from './summary.builder';
export { DEFAULT_EVENT_CATEGORIES, SORT_KEY_PHRASES } from './summary.catalogs';
export type {
    BuildEventListingSummaryInput,
    CatalogEntry,
    EventSort,
    EventSummaryFilters,
    FilterDescriptor,
    FilterDescriptorContext,
    SortDirection,
    SummaryCatalogs,
    SummaryCounts,
    SummaryLocale,
    SummaryOptions
} from './summary.types';
