/**
 * @file domain/poi-category.ts
 * @description Single source of truth for the POI category → visual mapping
 * ({ icon, bucket, colorToken }). Shared by `apps/web` and `apps/admin` so a
 * given POI category renders with the SAME icon and the SAME color in both
 * surfaces, and — within web — so a POI's map pin and its grid card can never
 * drift apart.
 *
 * ## Keyed by category slug, not by the `icon` column
 *
 * Keys are `poi_categories.slug` values — a closed set of 40 rows seeded from
 * `packages/seed/src/data/poiCategory/`. The `poi_categories.icon` column is
 * deliberately NOT consulted: it stores a Material Symbols slug
 * (`"beach_access"`, `"wine_bar"`), a vocabulary `@repo/icons` does not
 * implement, so it stays admin-facing data. Compare `attraction-icon.ts`, which
 * DOES key off the icon slug — attraction icons are free-typed rather than a
 * closed catalog, so there is no stable slug set to key on there.
 *
 * ## Why buckets instead of 40 hues
 *
 * Each category maps to one of 6 BUCKETS, and the bucket carries the hue. 40
 * distinct hues would be indistinguishable at pin size and impossible to
 * contrast-check across light and dark. The bucket → palette assignment lives in
 * `@repo/design-tokens` (`tokens/poi-categories.ts`); this module only decides
 * which bucket a category belongs to.
 *
 * ## Accessibility contract
 *
 * Consumers must NOT use this color as the only channel carrying meaning. On the
 * destination map, PRIMARY vs NEARBY pins stay distinguishable by size and
 * fill/outline treatment (WCAG) — the category hue rides ON TOP of that
 * distinction, it does not replace it.
 *
 * NOTE: this module intentionally does NOT depend on `@repo/schemas` — it keys
 * on plain string slugs so `@repo/icons` stays dependency-free and bundles in
 * both the React (admin) and Astro/React (web) toolchains.
 */

import type { ComponentType } from 'react';
import { TagIcon } from '../icons/admin/TagIcon';
import { BarServiceIcon } from '../icons/amenities/BarServiceIcon';
import { FirstAidKitIcon } from '../icons/amenities/FirstAidKitIcon';
import { TransferServiceIcon } from '../icons/amenities/TransferServiceIcon';
import { WalkingTrailIcon } from '../icons/amenities/WalkingTrailIcon';
import { AmphitheaterIcon } from '../icons/attractions/AmphitheaterIcon';
import { BeachIcon } from '../icons/attractions/BeachIcon';
import { BirdWatchingIcon } from '../icons/attractions/BirdWatchingIcon';
import { CasinoIcon } from '../icons/attractions/CasinoIcon';
import { CathedralIcon } from '../icons/attractions/CathedralIcon';
import { CraftsFairIcon } from '../icons/attractions/CraftsFairIcon';
import { CulturalCenterIcon } from '../icons/attractions/CulturalCenterIcon';
import { EventCenterIcon } from '../icons/attractions/EventCenterIcon';
import { GovernmentBuildingIcon } from '../icons/attractions/GovernmentBuildingIcon';
import { HistoricHouseIcon } from '../icons/attractions/HistoricHouseIcon';
import { HistoricMonumentIcon } from '../icons/attractions/HistoricMonumentIcon';
import { HistoricPalaceIcon } from '../icons/attractions/HistoricPalaceIcon';
import { InterpretationCenterIcon } from '../icons/attractions/InterpretationCenterIcon';
import { LocalDiscoIcon } from '../icons/attractions/LocalDiscoIcon';
import { MainSquareIcon } from '../icons/attractions/MainSquareIcon';
import { MuseumIcon } from '../icons/attractions/MuseumIcon';
import { ParkIcon } from '../icons/attractions/ParkIcon';
import { ProtectedAreaIcon } from '../icons/attractions/ProtectedAreaIcon';
import { RestaurantIcon } from '../icons/attractions/RestaurantIcon';
import { ShoppingCenterIcon } from '../icons/attractions/ShoppingCenterIcon';
import { SportsCenterIcon } from '../icons/attractions/SportsCenterIcon';
import { SportsComplexIcon } from '../icons/attractions/SportsComplexIcon';
import { ThermalPoolsIcon } from '../icons/attractions/ThermalPoolsIcon';
import { TouristPierIcon } from '../icons/attractions/TouristPierIcon';
import { WellnessCenterIcon } from '../icons/attractions/WellnessCenterIcon';
import { CampingAreaIcon } from '../icons/features/CampingAreaIcon';
import { FamilySuitableIcon } from '../icons/features/FamilySuitableIcon';
import { NaturalEnvironmentIcon } from '../icons/features/NaturalEnvironmentIcon';
import { PanoramicViewIcon } from '../icons/features/PanoramicViewIcon';
import { RiverFrontIcon } from '../icons/features/RiverFrontIcon';
import { BuildingIcon } from '../icons/system/BuildingIcon';
import { CompassIcon } from '../icons/system/CompassIcon';
import { GalleryIcon } from '../icons/system/GalleryIcon';
import { MapIcon } from '../icons/system/MapIcon';
import { UsersThreeIcon } from '../icons/system/UsersThreeIcon';
import { WrenchIcon } from '../icons/system/WrenchIcon';
import type { IconProps } from '../types';

/**
 * The 6 color buckets the 40 POI categories collapse into. Each has a matching
 * `--poi-category-<bucket>` token in `@repo/design-tokens`.
 */
export type PoiCategoryBucket = 'water' | 'nature' | 'culture' | 'food' | 'leisure' | 'services';

/**
 * Canonical visual descriptor for a POI category: the icon component, the color
 * bucket it belongs to, and the design-token name that bucket resolves to.
 */
export interface PoiCategoryVisual {
    /** Representative icon component from `@repo/icons`. */
    readonly icon: ComponentType<IconProps>;
    /** Color bucket this category belongs to. */
    readonly bucket: PoiCategoryBucket;
    /** Bucket design-token name (e.g. `'poi-category-water'`). */
    readonly colorToken: string;
}

/**
 * Color values for a POI marker or grid glyph. Both are valid CSS property
 * values intended for inline `style` / attribute use.
 */
export interface PoiCategoryColorScheme {
    /** The bucket hue. Use as a solid fill, an outline, or a standalone glyph color. */
    readonly fill: string;
    /** A readable color for a glyph drawn ON TOP of {@link fill}. */
    readonly onFill: string;
}

const visual = (icon: ComponentType<IconProps>, bucket: PoiCategoryBucket): PoiCategoryVisual => ({
    icon,
    bucket,
    colorToken: `poi-category-${bucket}`
});

/**
 * Canonical POI-category → visual map. Keys are `poi_categories.slug` values;
 * covers all 40 seeded categories.
 *
 * Grouped by bucket so a reviewer can check icon and color coherence together.
 */
export const POI_CATEGORY_VISUALS: Readonly<Record<string, PoiCategoryVisual>> = {
    // Water & coast
    beach: visual(BeachIcon, 'water'),
    waterfront: visual(RiverFrontIcon, 'water'),
    port: visual(TouristPierIcon, 'water'),
    thermal_complex: visual(ThermalPoolsIcon, 'water'),

    // Nature & outdoors
    park: visual(ParkIcon, 'nature'),
    natural_area: visual(NaturalEnvironmentIcon, 'nature'),
    reserve: visual(ProtectedAreaIcon, 'nature'),
    hiking: visual(WalkingTrailIcon, 'nature'),
    birdwatching: visual(BirdWatchingIcon, 'nature'),
    viewpoint: visual(PanoramicViewIcon, 'nature'),
    campground: visual(CampingAreaIcon, 'nature'),

    // Culture & heritage
    historic_site: visual(HistoricHouseIcon, 'culture'),
    museum: visual(MuseumIcon, 'culture'),
    monument: visual(HistoricMonumentIcon, 'culture'),
    religious_site: visual(CathedralIcon, 'culture'),
    cultural_center: visual(CulturalCenterIcon, 'culture'),
    art: visual(GalleryIcon, 'culture'),
    theater: visual(AmphitheaterIcon, 'culture'),
    architecture: visual(HistoricPalaceIcon, 'culture'),
    industrial_heritage: visual(BuildingIcon, 'culture'),

    // Food & nightlife
    gastronomy: visual(RestaurantIcon, 'food'),
    winery: visual(BarServiceIcon, 'food'),
    nightlife: visual(LocalDiscoIcon, 'food'),
    casino: visual(CasinoIcon, 'food'),
    entertainment: visual(EventCenterIcon, 'food'),
    fair: visual(CraftsFairIcon, 'food'),

    // Leisure & sport
    sports_venue: visual(SportsComplexIcon, 'leisure'),
    recreation: visual(SportsCenterIcon, 'leisure'),
    wellness: visual(WellnessCenterIcon, 'leisure'),
    family: visual(FamilySuitableIcon, 'leisure'),
    shopping: visual(ShoppingCenterIcon, 'leisure'),
    square: visual(MainSquareIcon, 'leisure'),
    tourist_route: visual(CompassIcon, 'leisure'),

    // Services & civic
    transport: visual(TransferServiceIcon, 'services'),
    services: visual(WrenchIcon, 'services'),
    health: visual(FirstAidKitIcon, 'services'),
    government: visual(GovernmentBuildingIcon, 'services'),
    community_center: visual(UsersThreeIcon, 'services'),
    education: visual(InterpretationCenterIcon, 'services'),
    other: visual(TagIcon, 'services')
};

/**
 * Fallback visual for a slug with no entry in {@link POI_CATEGORY_VISUALS} — a
 * category added without a matching entry, or dirty data (see HOS-177). Uses the
 * generic map icon + the neutral `services` bucket, so a marker still renders a
 * glyph instead of a blank gap.
 */
export const POI_CATEGORY_FALLBACK_VISUAL: PoiCategoryVisual = visual(MapIcon, 'services');

interface PoiCategoryParams {
    /** POI category slug (`poi_categories.slug`). Case-insensitive. */
    readonly slug?: string | null;
}

/**
 * Resolve the canonical visual descriptor for a POI category.
 *
 * @param params.slug - Category slug. Comparison is case-insensitive.
 * @returns The matching {@link PoiCategoryVisual}, or the fallback.
 */
export function getPoiCategoryVisual({ slug }: PoiCategoryParams): PoiCategoryVisual {
    if (!slug) return POI_CATEGORY_FALLBACK_VISUAL;
    return POI_CATEGORY_VISUALS[slug.toLowerCase()] ?? POI_CATEGORY_FALLBACK_VISUAL;
}

/**
 * Resolve the representative icon component for a POI category.
 *
 * Callers that still have a legacy `points_of_interest.type` should prefer
 * `getPointOfInterestTypeIcon` when `slug` is nullish — it carries more signal
 * than this module's generic fallback.
 *
 * @param params.slug - Category slug. Comparison is case-insensitive.
 * @returns The matching icon component, or `MapIcon` as fallback.
 */
export function getPoiCategoryIcon({ slug }: PoiCategoryParams): ComponentType<IconProps> {
    return getPoiCategoryVisual({ slug }).icon;
}

/**
 * Build a {@link PoiCategoryColorScheme} for a POI category. Both values derive
 * from the SAME bucket token, so the hue stays the single source of truth.
 *
 * `onFill` lightens the bucket hue to near-white while keeping a trace of its
 * chroma, so a glyph drawn on a solid `fill` pin stays legible in light and dark
 * without hardcoding a color.
 *
 * @param params.slug - Category slug. Comparison is case-insensitive.
 * @returns The bucket's {@link PoiCategoryColorScheme}.
 */
export function getPoiCategoryColorScheme({ slug }: PoiCategoryParams): PoiCategoryColorScheme {
    // Bucket tokens map 1:1 to their CSS custom property (no aliasing).
    const cssToken = getPoiCategoryVisual({ slug }).colorToken;
    return {
        fill: `var(--${cssToken})`,
        onFill: `oklch(from var(--${cssToken}) 0.98 calc(c * 0.2) h)`
    };
}
