/**
 * Venue and experience listing summary builder — public API (BETA-119).
 *
 * Provides the same rich, natural-language "Mostrando X de Y ..." summary
 * sentence already used by accommodations/events/posts, for the venue
 * and experience listing pages — which previously fell back to the generic
 * "N resultados encontrados" line.
 *
 * `buildVenueListingSummary` and `buildExperienceListingSummary` are
 * thin wrappers around the shared {@link buildListingSummary} that
 * supply each entity's fixed subject noun / gender / `hasPriceRange` config
 * (see `summary.types.ts` for why a single parametrized builder is used
 * instead of two near-duplicate per-entity modules).
 *
 * @example
 * ```ts
 * import { buildVenueListingSummary, DEFAULT_VENUE_TYPES } from '@/lib/listing-summary';
 *
 * const summary = buildVenueListingSummary({
 *     locale: 'es',
 *     filters: { type: 'RESTAURANT', destinationId: 'colon-id', isFeatured: true },
 *     counts: { shown: 3, total: 4 },
 *     sort: { sortKey: 'featured' },
 *     catalogs: {
 *         destinations: [{ key: 'colon-id', label: { es: 'Colón', en: 'Colón', pt: 'Colón' } }],
 *         types: DEFAULT_VENUE_TYPES
 *     }
 * });
 * // => 'Mostrando 3 de 4 establecimientos gastronómicos de restaurante en Colón, solo destacados, ordenados con los destacados primero.'
 * ```
 */

import { buildListingSummary } from './summary.builder';
import type { BuildListingSummaryInput, ListingEntityConfig } from './summary.types';

export { buildListingSummary } from './summary.builder';
export {
    DEFAULT_EXPERIENCE_TYPES,
    DEFAULT_PRICE_RANGES,
    DEFAULT_VENUE_TYPES
} from './summary.catalogs';
export type {
    BuildListingSummaryInput,
    CatalogEntry,
    EntityGender,
    FilterDescriptor,
    FilterDescriptorContext,
    ListingEntityConfig,
    ListingSort,
    ListingSummaryFilters,
    SummaryCatalogs,
    SummaryCounts,
    SummaryLocale
} from './summary.types';

/** Fixed entity config for venue listings — masculine noun, supports `priceRange`. */
const VENUE_ENTITY: ListingEntityConfig = {
    gender: 'masculine',
    subjectSingular: {
        es: 'establecimiento gastronómico',
        en: 'gastronomic establishment',
        pt: 'estabelecimento gastronômico'
    },
    subjectPlural: {
        es: 'establecimientos gastronómicos',
        en: 'gastronomic establishments',
        pt: 'estabelecimentos gastronômicos'
    },
    hasPriceRange: true
};

/** Fixed entity config for experience listings — feminine noun, no `priceRange` facet. */
const EXPERIENCE_ENTITY: ListingEntityConfig = {
    gender: 'feminine',
    subjectSingular: { es: 'experiencia', en: 'experience', pt: 'experiência' },
    subjectPlural: { es: 'experiencias', en: 'experiences', pt: 'experiências' },
    hasPriceRange: false
};

/** Build the venue listing summary sentence. See the module doc for an example. */
export function buildVenueListingSummary(input: Omit<BuildListingSummaryInput, 'entity'>): string {
    return buildListingSummary({ ...input, entity: VENUE_ENTITY });
}

/** Build the experience listing summary sentence. See the module doc for an example. */
export function buildExperienceListingSummary(
    input: Omit<BuildListingSummaryInput, 'entity'>
): string {
    return buildListingSummary({ ...input, entity: EXPERIENCE_ENTITY });
}
