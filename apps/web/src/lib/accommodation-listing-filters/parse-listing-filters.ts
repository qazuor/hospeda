import { buildAvailabilityParams } from '@/lib/availability-params';
import type { AccommodationSummaryFilters } from '../accommodation-listing-summary';
import { ACCOMMODATION_LISTING_FILTER_PARAMS } from './listing-filter-params';

/** Parsed listing filters shared by the listing pages and summary. */
export interface ParsedAccommodationListingFilters {
    readonly values: Record<string, unknown>;
    readonly apiQuery: Record<string, unknown>;
    readonly summaryFilters: AccommodationSummaryFilters;
    readonly q?: string;
    readonly types?: string;
    readonly legacyType?: string;
    readonly destinationIds?: string;
    readonly minPrice?: number;
    readonly maxPrice?: number;
    readonly adults?: number;
    readonly childrenCount?: number;
    readonly minBedrooms?: number;
    readonly minBathrooms?: number;
    readonly minRating?: number;
    readonly amenitiesParam?: string;
    readonly featuresParam?: string;
    readonly includeNoPrice?: false;
    readonly includeNoReviews?: false;
    readonly hasWifi?: true;
    readonly hasPool?: true;
    readonly hasParking?: true;
    readonly allowsPets?: true;
    readonly isFeatured?: true;
    readonly latitude: number;
    readonly longitude: number;
    readonly radius: number;
    readonly hasLatLongRadius: boolean;
    readonly hasGeoRadius: boolean;
    readonly poiIdRaw?: string;
    readonly poiSlugRaw?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
    readonly availabilityParams: ReturnType<typeof buildAvailabilityParams>;
    readonly minGuests?: number;
}

/** Reads only registered listing filters and derives API and summary contracts. */
export function parseAccommodationListingFilters(input: {
    searchParams: URLSearchParams;
    ignoreTypeFacet?: boolean;
}): ParsedAccommodationListingFilters {
    const raw: Record<string, string | null> = {};
    for (const { param } of ACCOMMODATION_LISTING_FILTER_PARAMS) {
        if (input.ignoreTypeFacet && (param === 'types' || param === 'type')) continue;
        raw[param] = input.searchParams.get(param);
    }
    const get = (key: string) => raw[key] ?? null;
    const number = (key: string) => (get(key) ? Number(get(key)) : undefined);
    const q = get('q') ?? undefined,
        types = get('types') ?? undefined,
        legacyType = get('type') ?? undefined;
    const destinationIds = get('destinationIds') ?? undefined;
    const minPrice = number('minPrice'),
        maxPrice = number('maxPrice'),
        adults = number('adults'),
        childrenCount = number('children');
    const minBedrooms = number('minBedrooms'),
        minBathrooms = number('minBathrooms'),
        minRating = number('minRating');
    const amenitiesParam = get('amenities') ?? undefined,
        featuresParam = get('features') ?? undefined;
    const includeNoPrice = get('includeNoPrice') === 'false' ? false : undefined;
    const includeNoReviews = get('includeNoReviews') === 'false' ? false : undefined;
    const hasWifi = get('hasWifi') === 'true' ? true : undefined,
        hasPool = get('hasPool') === 'true' ? true : undefined;
    const hasParking = get('hasParking') === 'true' ? true : undefined,
        allowsPets = get('allowsPets') === 'true' ? true : undefined;
    const isFeatured = get('isFeatured') === 'true' ? true : undefined;
    const latitudeRaw = get('latitude'),
        longitudeRaw = get('longitude'),
        radiusRaw = get('radius');
    const latitude = latitudeRaw === null ? Number.NaN : Number.parseFloat(latitudeRaw);
    const longitude = longitudeRaw === null ? Number.NaN : Number.parseFloat(longitudeRaw);
    const radius = radiusRaw === null ? Number.NaN : Number.parseFloat(radiusRaw);
    const hasLatLongRadius =
        Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radius);
    const poiIdRaw = get('poiId') ?? undefined,
        poiSlugRaw = poiIdRaw ? undefined : (get('poiSlug') ?? undefined);
    const hasGeoRadius =
        hasLatLongRadius || Boolean((poiIdRaw || poiSlugRaw) && Number.isFinite(radius));
    const checkIn = get('checkIn') ?? undefined,
        checkOut = get('checkOut') ?? undefined;
    const availabilityParams = buildAvailabilityParams({ checkIn, checkOut });
    const minGuests =
        (adults ?? 0) + (childrenCount ?? 0) > 0 ? (adults ?? 0) + (childrenCount ?? 0) : undefined;
    const apiQuery = {
        q,
        types,
        type: legacyType,
        destinationIds,
        minPrice,
        maxPrice,
        isFeatured,
        minGuests,
        minBedrooms,
        minBathrooms,
        minRating,
        amenities: amenitiesParam,
        features: featuresParam,
        includeNoPrice,
        includeNoReviews,
        hasWifi,
        hasPool,
        hasParking,
        allowsPets,
        latitude: hasLatLongRadius ? latitude : undefined,
        longitude: hasLatLongRadius ? longitude : undefined,
        radius: hasGeoRadius ? radius : undefined,
        poiId: poiIdRaw,
        poiSlug: poiSlugRaw,
        ...availabilityParams
    };
    const summaryFilters: AccommodationSummaryFilters = {
        types: (types ?? legacyType)?.split(',').filter(Boolean),
        text: q,
        price:
            minPrice !== undefined || maxPrice !== undefined || includeNoPrice
                ? { min: minPrice, max: maxPrice, includeWithoutPrice: includeNoPrice }
                : undefined,
        destinations: destinationIds?.split(',').filter(Boolean),
        guests: minGuests,
        amenities: amenitiesParam?.split(',').filter(Boolean),
        services: featuresParam?.split(',').filter(Boolean),
        minRating,
        includeWithoutRating: includeNoReviews,
        bedrooms: minBedrooms,
        bathrooms: minBathrooms,
        featured: isFeatured ?? null,
        quickAmenities: { wifi: hasWifi, pool: hasPool, parking: hasParking, pets: allowsPets },
        location: hasGeoRadius ? { radiusKm: radius } : undefined,
        availability: checkIn && checkOut ? { checkIn, checkOut } : undefined
    };
    return {
        values: raw,
        apiQuery,
        summaryFilters,
        q,
        types,
        legacyType,
        destinationIds,
        minPrice,
        maxPrice,
        adults,
        childrenCount,
        minBedrooms,
        minBathrooms,
        minRating,
        amenitiesParam,
        featuresParam,
        includeNoPrice,
        includeNoReviews,
        hasWifi,
        hasPool,
        hasParking,
        allowsPets,
        isFeatured,
        latitude,
        longitude,
        radius,
        hasLatLongRadius,
        hasGeoRadius,
        poiIdRaw,
        poiSlugRaw,
        checkIn,
        checkOut,
        availabilityParams,
        minGuests
    };
}
