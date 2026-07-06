/**
 * Commerce listing summary builder — public API (BETA-119).
 *
 * Provides the same rich, natural-language "Mostrando X de Y ..." summary
 * sentence already used by accommodations/events/posts, for the gastronomy
 * and experience listing pages — which previously fell back to the generic
 * "N resultados encontrados" line.
 *
 * `buildGastronomyListingSummary` and `buildExperienceListingSummary` are
 * thin wrappers around the shared {@link buildCommerceListingSummary} that
 * supply each entity's fixed subject noun / gender / `hasPriceRange` config
 * (see `summary.types.ts` for why a single parametrized builder is used
 * instead of two near-duplicate per-entity modules).
 *
 * @example
 * ```ts
 * import { buildGastronomyListingSummary, DEFAULT_GASTRONOMY_TYPES } from '@/lib/commerce-listing-summary';
 *
 * const summary = buildGastronomyListingSummary({
 *     locale: 'es',
 *     filters: { type: 'RESTAURANT', destinationId: 'colon-id', isFeatured: true },
 *     counts: { shown: 3, total: 4 },
 *     sort: { sortKey: 'featured' },
 *     catalogs: {
 *         destinations: [{ key: 'colon-id', label: { es: 'Colón', en: 'Colón' } }],
 *         types: DEFAULT_GASTRONOMY_TYPES
 *     }
 * });
 * // => 'Mostrando 3 de 4 establecimientos gastronómicos de restaurante en Colón, solo destacados, ordenados con los destacados primero.'
 * ```
 */

import { buildCommerceListingSummary } from './summary.builder';
import type { BuildCommerceListingSummaryInput, CommerceEntityConfig } from './summary.types';

export { buildCommerceListingSummary } from './summary.builder';
export {
    DEFAULT_EXPERIENCE_TYPES,
    DEFAULT_GASTRONOMY_TYPES,
    DEFAULT_PRICE_RANGES
} from './summary.catalogs';
export type {
    BuildCommerceListingSummaryInput,
    CatalogEntry,
    CommerceEntityConfig,
    CommerceSort,
    CommerceSummaryFilters,
    EntityGender,
    FilterDescriptor,
    FilterDescriptorContext,
    SummaryCatalogs,
    SummaryCounts,
    SummaryLocale
} from './summary.types';

/** Fixed entity config for gastronomy listings — masculine noun, supports `priceRange`. */
const GASTRONOMY_ENTITY: CommerceEntityConfig = {
    gender: 'masculine',
    subjectSingular: { es: 'establecimiento gastronómico', en: 'gastronomic establishment' },
    subjectPlural: { es: 'establecimientos gastronómicos', en: 'gastronomic establishments' },
    hasPriceRange: true
};

/** Fixed entity config for experience listings — feminine noun, no `priceRange` facet. */
const EXPERIENCE_ENTITY: CommerceEntityConfig = {
    gender: 'feminine',
    subjectSingular: { es: 'experiencia', en: 'experience' },
    subjectPlural: { es: 'experiencias', en: 'experiences' },
    hasPriceRange: false
};

/** Build the gastronomy listing summary sentence. See the module doc for an example. */
export function buildGastronomyListingSummary(
    input: Omit<BuildCommerceListingSummaryInput, 'entity'>
): string {
    return buildCommerceListingSummary({ ...input, entity: GASTRONOMY_ENTITY });
}

/** Build the experience listing summary sentence. See the module doc for an example. */
export function buildExperienceListingSummary(
    input: Omit<BuildCommerceListingSummaryInput, 'entity'>
): string {
    return buildCommerceListingSummary({ ...input, entity: EXPERIENCE_ENTITY });
}
