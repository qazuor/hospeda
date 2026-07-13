import { PointOfInterestCategoryService } from '@repo/service-core';
import requiredManifest from '../manifest-required.json';
import { createSeedFactory } from '../utils/index.js';
import type { SeedContext } from '../utils/seedContext.js';

/**
 * Normalizes a raw POI category fixture item into `service.create()`-ready
 * data (HOS-139 spec §7.5).
 *
 * Strips the metadata/auto-generated fields (`$schema`, `id`,
 * `lifecycleState` — the latter defaults to `ACTIVE` via
 * `BaseLifecycleFields`, same as `attractions.seed.ts` /
 * `pointsOfInterest.seed.ts`). **`slug` is intentionally KEPT**, mirroring
 * `pointsOfInterest.seed.ts`'s normalizer rather than `attractions.seed.ts`'s:
 * `PointOfInterestCategoryService`'s `normalizeCreateInput` never derives a
 * slug from `nameI18n` (`poi-category.normalizers.ts` — "slug is always
 * caller-provided, no name-derived slug generation"), so the fixture's own
 * curated `slug` must pass through unchanged.
 *
 * Exported (rather than an inline lambda) so tests can validate it against
 * every real fixture without running the full seed pipeline against a
 * database — mirrors `normalizePointOfInterestSeedItem`'s testability
 * pattern.
 *
 * @param data - Raw fixture item, as loaded from `src/data/poiCategory/*.json`
 * @returns The cleaned data payload, ready for `PoiCategoryCreateInputSchema`
 */
export const normalizePoiCategorySeedItem = (
    data: Record<string, unknown>
): Record<string, unknown> => {
    const { $schema, id, lifecycleState, ...cleanData } = data as {
        $schema?: string;
        id?: string;
        lifecycleState?: string;
        [key: string]: unknown;
    };

    return cleanData;
};

/**
 * Formats a POI category fixture item for seed-progress logging.
 *
 * @param item - Raw fixture item
 * @param _context - Seed context (unused, matches `SeedFactoryConfig`'s signature)
 */
export const getPoiCategoryEntityInfo = (item: unknown, _context: SeedContext): string => {
    const category = item as { slug: string; nameI18n?: { es?: string } };
    return `"${category.slug}" (${category.nameI18n?.es ?? category.slug})`;
};

/**
 * Seed factory for the POI category catalog (HOS-139 spec §6.3/§7.5).
 *
 * Creates the 40 `poi_categories` rows from JSON fixtures under
 * `src/data/poiCategory/`, mirroring `attractions.seed.ts`/
 * `pointsOfInterest.seed.ts`'s `createSeedFactory` shape. This is a
 * standalone catalog — it does not depend on points of interest or
 * destinations having been seeded first; the 12-POI backfill that assigns
 * these categories to existing POIs is a separate step
 * (`poiCategoryBackfill.seed.ts`) run after both this seed and
 * `pointsOfInterest.seed.ts` have completed.
 *
 * @example
 * ```typescript
 * await seedPoiCategories(seedContext);
 * // Creates categories like:
 * // "historic_site" (Sitio histórico)
 * // "beach" (Playa)
 * ```
 */
export const seedPoiCategories = createSeedFactory({
    entityName: 'PoiCategories',
    serviceClass: PointOfInterestCategoryService,
    folder: 'src/data/poiCategory',
    files: requiredManifest.poiCategories,
    normalizer: normalizePoiCategorySeedItem,
    getEntityInfo: getPoiCategoryEntityInfo
});
