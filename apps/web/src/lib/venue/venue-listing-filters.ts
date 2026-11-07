/**
 * @file venue-listing-filters.ts
 * @description Pure, transport-free `FilterGroup[]` and type-chip builders for
 * the venue listings (`/comer-y-salir/` and its business-line collections).
 *
 * The two pages used to spell the sidebar out inline and drifted on nothing
 * because they re-derived every group by hand. HOS-1787 leaf 6.10 narrows those
 * groups per collection (only values that have a published listing), so the
 * shape moved here to keep the general listing and every collection on one
 * definition.
 *
 * The helper deliberately knows nothing about business lines: the collection is
 * already resolved by the server, which passes the narrowed catalogs in. It
 * never reads rubros, never compares business-line values and never imports the
 * business-line catalog — G-FAC-03/G-FAC-09 keep that decision in one place.
 */

import type { AmenityPublic, FeaturePublic, VenuePublicFilterOptions } from '@repo/schemas';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import { buildToggleParamHref } from '@/lib/filters/toggle-query-param';
import type { TranslationFn } from '@/lib/i18n';
import { getVenueTypeIcon } from '@/lib/venue-type-icons';
import { VENUE_TYPE_OPTIONS } from './venue-type-options';

/** Price-range tiers offered by the venue sidebar, in display order. */
const PRICE_RANGES = ['BUDGET', 'MID', 'HIGH', 'PREMIUM'] as const;

/** Active URL selections the narrowing must always keep visible. */
export interface ActiveVenueFilterValues {
    /** Active `?type=` value, if any. */
    readonly type?: string;
    /** Active `?amenities=` UUIDs (CSV split by the caller). */
    readonly amenityIds?: readonly string[];
    /** Active `?features=` UUIDs (CSV split by the caller). */
    readonly featureIds?: readonly string[];
}

/** Input for {@link narrowVenueFilterCatalog}. */
export interface NarrowVenueFilterCatalogParams {
    /**
     * The `data` of `venueApi.getFilterOptions`, or `null` when that fetch
     * failed. `null` fails closed: only the active values survive, so a broken
     * options request can never advertise a filter with no published listings.
     */
    readonly filterOptions: VenuePublicFilterOptions | null;
    /** Full venue amenity catalog, already in `displayWeight` order. */
    readonly amenities: readonly AmenityPublic[];
    /** Full venue feature catalog, already in `displayWeight` order. */
    readonly features: readonly FeaturePublic[];
    /** Current URL selections that must remain user-clearable. */
    readonly active: ActiveVenueFilterValues;
}

/** Narrowed catalogs handed to {@link buildVenueFilterGroups} and the chips. */
export interface NarrowedVenueFilterCatalog {
    readonly types: readonly string[];
    readonly amenities: readonly AmenityPublic[];
    readonly features: readonly FeaturePublic[];
}

/** Input for {@link buildVenueFilterGroups}. */
export interface BuildVenueFilterGroupsParams {
    /** Bound translation function for the active locale. */
    readonly t: TranslationFn;
    /** Destinations catalog used by the location group. */
    readonly destinations: readonly {
        readonly id: string;
        readonly name: string;
        readonly isFeatured?: boolean | null;
    }[];
    /** Venue types that may be offered (already narrowed). */
    readonly types: readonly string[];
    /** Amenities that may be offered (already narrowed). */
    readonly amenities: readonly AmenityPublic[];
    /** Features that may be offered (already narrowed). */
    readonly features: readonly FeaturePublic[];
}

/** Input for {@link buildVenueTypeChips}. */
export interface BuildVenueTypeChipsParams {
    /** Bound translation function for the active locale. */
    readonly t: TranslationFn;
    /** Venue types that may be offered (already narrowed). */
    readonly types: readonly string[];
    /** Canonical listing base URL, trailing slash, no query string. */
    readonly baseUrl: string;
    /** Current URL search params (other filters/sort are preserved). */
    readonly searchParams: URLSearchParams;
    /** Active `?type=` value, if any. */
    readonly activeType?: string;
}

/**
 * Narrows the venue filter catalogs to the values that actually have published
 * listings, while always keeping the visitor's active selections.
 *
 * - `types` follows the canonical enum order (`VENUE_TYPE_OPTIONS`).
 * - `amenities` and `features` keep the order they arrive in, which is the
 *   catalog's `displayWeight` order.
 * - A value selected in the URL survives even when no listing carries it
 *   anymore: hiding it would leave an applied, invisible filter the visitor
 *   cannot clear.
 * - `filterOptions === null` means the options fetch failed, so the function
 *   fails closed and returns only the active values.
 *
 * @param params - See {@link NarrowVenueFilterCatalogParams}.
 * @returns The narrowed catalogs, in stable order.
 */
export function narrowVenueFilterCatalog({
    filterOptions,
    amenities,
    features,
    active
}: NarrowVenueFilterCatalogParams): NarrowedVenueFilterCatalog {
    const activeAmenityIds = new Set(active.amenityIds ?? []);
    const activeFeatureIds = new Set(active.featureIds ?? []);

    if (filterOptions === null) {
        return {
            types: active.type ? VENUE_TYPE_OPTIONS.filter((value) => value === active.type) : [],
            amenities: amenities.filter((amenity) => activeAmenityIds.has(amenity.id)),
            features: features.filter((feature) => activeFeatureIds.has(feature.id))
        };
    }

    const allowedTypes = new Set<string>(filterOptions.types);
    const allowedAmenityIds = new Set(filterOptions.amenityIds);
    const allowedFeatureIds = new Set(filterOptions.featureIds);

    return {
        types: VENUE_TYPE_OPTIONS.filter(
            (value) => allowedTypes.has(value) || value === active.type
        ),
        amenities: amenities.filter(
            (amenity) => allowedAmenityIds.has(amenity.id) || activeAmenityIds.has(amenity.id)
        ),
        features: features.filter(
            (feature) => allowedFeatureIds.has(feature.id) || activeFeatureIds.has(feature.id)
        )
    };
}

/**
 * Builds the venue sidebar groups: search, destination, type, price range,
 * featured toggle, amenities, features and minimum rating.
 *
 * A catalog group is emitted only when it has options — an icon-chips header
 * over nothing reads as a broken filter. The same rule applies to the type
 * checkbox group: an empty list is not a filter.
 *
 * Labels resolve through the venue namespace (`venue.*`) and the shared
 * amenity/feature name keys keyed by slug, exactly as the pages did inline.
 *
 * @param params - See {@link BuildVenueFilterGroupsParams}.
 * @returns The `FilterGroup[]` consumed by `FilterSidebar`.
 */
export function buildVenueFilterGroups({
    t,
    destinations,
    types,
    amenities,
    features
}: BuildVenueFilterGroupsParams): FilterGroup[] {
    return [
        {
            id: 'q',
            label: t('venue.listing.search'),
            type: 'search',
            placeholder: t('venue.listing.searchPlaceholder')
        },
        {
            id: 'destinationId',
            label: t('venue.listing.destination'),
            type: 'select-search',
            options: destinations.map((destination) => ({
                value: destination.id,
                label: destination.name,
                featured: Boolean(destination.isFeatured)
            })),
            maxVisible: 8
        },
        ...(types.length > 0
            ? ([
                  {
                      id: 'type',
                      label: t('venue.listing.type'),
                      type: 'checkbox',
                      options: types.map((value) => ({
                          value,
                          label: t(`venue.types.${value}`, value)
                      }))
                  }
              ] satisfies FilterGroup[])
            : []),
        {
            id: 'priceRange',
            label: t('venue.listing.priceRange'),
            type: 'checkbox',
            options: PRICE_RANGES.map((value) => ({
                value,
                label: t(`venue.card.priceRange.${value}`, value)
            }))
        },
        {
            id: 'isFeatured',
            label: t('venue.listing.featured'),
            type: 'toggle'
        },
        ...(amenities.length > 0
            ? ([
                  {
                      id: 'amenities',
                      label: t('venue.listing.amenities'),
                      type: 'icon-chips',
                      options: amenities.map((amenity) => ({
                          value: amenity.id,
                          label: t(
                              `accommodations.amenityNames.${amenity.slug ?? ''}`,
                              amenity.slug ?? undefined
                          ),
                          icon: amenity.icon ?? undefined
                      })),
                      maxVisible: 10
                  }
              ] satisfies FilterGroup[])
            : []),
        ...(features.length > 0
            ? ([
                  {
                      id: 'features',
                      label: t('venue.listing.features'),
                      type: 'icon-chips',
                      options: features.map((feature) => ({
                          value: feature.id,
                          label: t(
                              `accommodations.featureNames.${feature.slug ?? ''}`,
                              feature.slug ?? undefined
                          ),
                          icon: feature.icon ?? undefined
                      })),
                      maxVisible: 10
                  }
              ] satisfies FilterGroup[])
            : []),
        {
            id: 'minRating',
            label: t('venue.listing.minRating'),
            type: 'stars'
        }
    ];
}

/**
 * Builds the quick-filter type chips: one per offered venue type, toggling
 * `?type=<value>` in place while preserving every other active filter/sort.
 *
 * Only the types handed in are rendered; the caller narrows them to the ones
 * with published listings. The chip for the active type is flagged so the UI
 * can highlight it (clicking it clears the filter).
 *
 * @param params - See {@link BuildVenueTypeChipsParams}.
 * @returns The chip descriptors consumed by `FilterChips`.
 */
export function buildVenueTypeChips({
    t,
    types,
    baseUrl,
    searchParams,
    activeType
}: BuildVenueTypeChipsParams): {
    readonly label: string;
    readonly href: string;
    readonly active: boolean;
    readonly icon: ReturnType<typeof getVenueTypeIcon>;
}[] {
    return types.map((value) => {
        const isActive = activeType === value;
        return {
            label: t(`venue.types.${value}`, value),
            href: buildToggleParamHref({
                baseUrl,
                searchParams,
                key: 'type',
                value,
                isActive
            }),
            active: isActive,
            icon: getVenueTypeIcon({ type: value })
        };
    });
}
