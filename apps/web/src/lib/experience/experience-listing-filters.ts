/**
 * @file experience-listing-filters.ts
 * @description Transport-free amenity and feature filter helpers for the public
 * experiences listing (`/experiencias/`), HOS-2085.
 *
 * Mirrors the venue listing (`@/lib/venue/venue-listing-filters`): the sidebar
 * offers every catalog item that at least one PUBLISHED experience holds
 * (the per-collection calculation of HOS-1870), grouped by category in the
 * "Ver más" dialog (HOS-2061). Both builders are pure so the page stays a thin
 * wiring layer and the behavior is testable without rendering Astro.
 */

import type { AmenityPublic, ExperiencePublicFilterOptions, FeaturePublic } from '@repo/schemas';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import {
    buildAmenityFilterCategories,
    buildFeatureFilterCategories
} from '@/lib/catalog-categories';
import type { TranslationFn } from '@/lib/i18n';

/** Active URL selections the narrowing must always keep visible. */
export interface ActiveExperienceCatalogValues {
    /** Active `?amenities=` UUIDs (CSV split by the caller). */
    readonly amenityIds?: readonly string[];
    /** Active `?features=` UUIDs (CSV split by the caller). */
    readonly featureIds?: readonly string[];
}

/** Input for {@link narrowExperienceCatalog}. */
export interface NarrowExperienceCatalogParams {
    /**
     * The `data` of `experiencesApi.getFilterOptions`, or `null` when that fetch
     * failed. `null` fails closed: only the active values survive, so a broken
     * options request can never advertise a filter with no published listings.
     */
    readonly filterOptions: ExperiencePublicFilterOptions | null;
    /** Full experience amenity catalog, already in `displayWeight` order. */
    readonly amenities: readonly AmenityPublic[];
    /** Full experience feature catalog, already in `displayWeight` order. */
    readonly features: readonly FeaturePublic[];
    /** Current URL selections that must remain user-clearable. */
    readonly active: ActiveExperienceCatalogValues;
}

/** Narrowed catalogs handed to {@link buildExperienceCatalogFilterGroups}. */
export interface NarrowedExperienceCatalog {
    readonly amenities: readonly AmenityPublic[];
    readonly features: readonly FeaturePublic[];
}

/**
 * Narrows the experience amenity and feature catalogs to the values that have
 * published listings, always keeping the visitor's active selections (hiding
 * one would leave an applied, invisible filter the visitor cannot clear).
 *
 * @param params - See {@link NarrowExperienceCatalogParams}.
 * @returns The narrowed catalogs, in the order they arrived in.
 */
export function narrowExperienceCatalog({
    filterOptions,
    amenities,
    features,
    active
}: NarrowExperienceCatalogParams): NarrowedExperienceCatalog {
    const activeAmenityIds = new Set(active.amenityIds ?? []);
    const activeFeatureIds = new Set(active.featureIds ?? []);
    const allowedAmenityIds = new Set(filterOptions?.amenityIds ?? []);
    const allowedFeatureIds = new Set(filterOptions?.featureIds ?? []);

    return {
        amenities: amenities.filter(
            (amenity) => allowedAmenityIds.has(amenity.id) || activeAmenityIds.has(amenity.id)
        ),
        features: features.filter(
            (feature) => allowedFeatureIds.has(feature.id) || activeFeatureIds.has(feature.id)
        )
    };
}

/** Input for {@link buildExperienceCatalogFilterGroups}. */
export interface BuildExperienceCatalogFilterGroupsParams {
    /** Bound translation function for the active locale. */
    readonly t: TranslationFn;
    /** Amenities that may be offered (already narrowed). */
    readonly amenities: readonly AmenityPublic[];
    /** Features that may be offered (already narrowed). */
    readonly features: readonly FeaturePublic[];
}

/**
 * Builds the amenities and features sidebar groups. A group is emitted only
 * when it has options: an icon-chips header over nothing reads as a broken
 * filter. Item labels resolve by slug through the shared
 * `accommodations.amenityNames.*` / `accommodations.featureNames.*` keys.
 *
 * @param params - See {@link BuildExperienceCatalogFilterGroupsParams}.
 * @returns Zero, one, or two `FilterGroup`s, in sidebar order.
 */
export function buildExperienceCatalogFilterGroups({
    t,
    amenities,
    features
}: BuildExperienceCatalogFilterGroupsParams): FilterGroup[] {
    return [
        ...(amenities.length > 0
            ? ([
                  {
                      id: 'amenities',
                      label: t('experience.listing.amenities', 'Comodidades'),
                      type: 'icon-chips',
                      options: amenities.map((amenity) => ({
                          value: amenity.id,
                          label: t(
                              `accommodations.amenityNames.${amenity.slug ?? ''}`,
                              amenity.slug ?? undefined
                          ),
                          icon: amenity.icon ?? undefined
                      })),
                      maxVisible: 10,
                      categories: buildAmenityFilterCategories({ amenities, t })
                  }
              ] satisfies FilterGroup[])
            : []),
        ...(features.length > 0
            ? ([
                  {
                      id: 'features',
                      label: t('experience.listing.features', 'Características'),
                      type: 'icon-chips',
                      options: features.map((feature) => ({
                          value: feature.id,
                          label: t(
                              `accommodations.featureNames.${feature.slug ?? ''}`,
                              feature.slug ?? undefined
                          ),
                          icon: feature.icon ?? undefined
                      })),
                      maxVisible: 10,
                      categories: buildFeatureFilterCategories({ features, t })
                  }
              ] satisfies FilterGroup[])
            : [])
    ];
}
