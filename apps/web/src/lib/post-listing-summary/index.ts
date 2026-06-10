/**
 * Post listing summary builder — public API.
 *
 * Mirrors `event-listing-summary` but with the post-specific filter shape
 * (text, category, destinationId, publishedAfter/Before, isFeatured).
 *
 * @example
 * ```ts
 * import { buildPostListingSummary, DEFAULT_POST_CATEGORIES } from './post-listing-summary';
 *
 * const summary = buildPostListingSummary({
 *     locale: 'es',
 *     filters: { category: 'CULTURE', destinationId: 'colon-id', isFeatured: true },
 *     counts: { shown: 3, total: 4 },
 *     sort: { sortKey: 'newest' },
 *     catalogs: {
 *         destinations: [{ key: 'colon-id', label: { es: 'Colón', en: 'Colón' } }],
 *         categories: DEFAULT_POST_CATEGORIES
 *     }
 * });
 * // => 'Mostrando 3 de 4 publicaciones de cultura sobre Colón, solo destacadas, ordenadas por publicación más reciente.'
 * ```
 */

export { buildPostListingSummary } from './summary.builder';
export { DEFAULT_POST_CATEGORIES, SORT_KEY_PHRASES } from './summary.catalogs';
export type {
    BuildPostListingSummaryInput,
    CatalogEntry,
    FilterDescriptor,
    FilterDescriptorContext,
    PostSort,
    PostSummaryFilters,
    SortDirection,
    SummaryCatalogs,
    SummaryCounts,
    SummaryLocale,
    SummaryOptions
} from './summary.types';
