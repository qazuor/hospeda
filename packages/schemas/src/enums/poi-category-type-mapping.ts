import { PointOfInterestTypeEnum } from './point-of-interest-type.enum.js';

/**
 * Legacy `PointOfInterestTypeEnum` → new `poi_categories.slug` mapping
 * (HOS-139 spec §7.4).
 *
 * One-time backfill tool for the 12 existing seeded POIs (spec §6.3); the
 * future bulk-import issue (out of scope here) can reuse it verbatim for any
 * dataset row whose only available signal is a legacy-shaped `type` value.
 *
 * Note: `NATURAL → natural_area` is a judgment call, not a 1:1 identity
 * mapping like the other 8 rows — see spec R-3 before reusing this table
 * outside its one-time backfill scope.
 */
export const POI_TYPE_TO_CATEGORY_SLUG: Readonly<Record<PointOfInterestTypeEnum, string>> = {
    [PointOfInterestTypeEnum.BEACH]: 'beach',
    [PointOfInterestTypeEnum.STADIUM]: 'sports_venue',
    [PointOfInterestTypeEnum.PARK]: 'park',
    [PointOfInterestTypeEnum.MUSEUM]: 'museum',
    [PointOfInterestTypeEnum.PLAZA]: 'square',
    [PointOfInterestTypeEnum.MONUMENT]: 'monument',
    [PointOfInterestTypeEnum.VIEWPOINT]: 'viewpoint',
    [PointOfInterestTypeEnum.NATURAL]: 'natural_area',
    [PointOfInterestTypeEnum.OTHER]: 'other'
} as const;

/**
 * New category `slug` → legacy `PointOfInterestTypeEnum` reverse mapping
 * (HOS-139 spec §7.6), used by the `type`-sync (spec §6.5): the service
 * writes this derived `type` in the same transaction as every
 * primary-category change.
 *
 * Only the 9 categories with a direct enum equivalent are keys here — every
 * other slug (`winery`, `gastronomy`, `religious_site`, an unknown/future
 * slug, ...) has no entry. Use {@link deriveTypeFromCategorySlug} for the
 * total (never-throws, catch-all-to-`OTHER`) version consumed by the service.
 */
export const CATEGORY_SLUG_TO_POI_TYPE: Readonly<Record<string, PointOfInterestTypeEnum>> = {
    beach: PointOfInterestTypeEnum.BEACH,
    sports_venue: PointOfInterestTypeEnum.STADIUM,
    park: PointOfInterestTypeEnum.PARK,
    museum: PointOfInterestTypeEnum.MUSEUM,
    square: PointOfInterestTypeEnum.PLAZA,
    monument: PointOfInterestTypeEnum.MONUMENT,
    viewpoint: PointOfInterestTypeEnum.VIEWPOINT,
    natural_area: PointOfInterestTypeEnum.NATURAL,
    other: PointOfInterestTypeEnum.OTHER
} as const;

/**
 * Derives the legacy `points_of_interest.type` enum value from a primary
 * category's `slug` (HOS-139 spec §6.5/§7.6).
 *
 * Total function: any slug with a direct mapping resolves to its
 * equivalent; every other slug — including an unknown or future category —
 * derives to `OTHER`. Never throws, so adding a 41st category later never
 * breaks the `type` sync; it just derives to `OTHER` until someone extends
 * {@link CATEGORY_SLUG_TO_POI_TYPE}.
 *
 * @param slug - The primary category's slug.
 * @returns The derived `PointOfInterestTypeEnum` value.
 *
 * @example
 * ```ts
 * deriveTypeFromCategorySlug('beach')   // PointOfInterestTypeEnum.BEACH
 * deriveTypeFromCategorySlug('winery')  // PointOfInterestTypeEnum.OTHER
 * deriveTypeFromCategorySlug('unknown') // PointOfInterestTypeEnum.OTHER
 * ```
 */
export const deriveTypeFromCategorySlug = (slug: string): PointOfInterestTypeEnum =>
    CATEGORY_SLUG_TO_POI_TYPE[slug] ?? PointOfInterestTypeEnum.OTHER;
