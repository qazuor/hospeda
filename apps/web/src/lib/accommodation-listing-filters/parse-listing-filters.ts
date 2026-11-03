import { buildAvailabilityParams } from '@/lib/availability-params';
import type { AccommodationSummaryFilters } from '../accommodation-listing-summary';
import { ACCOMMODATION_LISTING_FILTER_PARAMS } from './listing-filter-params';

/** Query params that change ordering only. They are never filters but must survive pagination. */
const PAGINATION_CARRIED_CONTROL_PARAMS = ['sortBy', 'sortOrder'] as const;

/** Filter keys sent to `accommodationsApi.list`. Mirrors the keys the listing pages used to build by hand. */
export interface AccommodationListingApiQuery {
    readonly q?: string;
    readonly types?: string;
    readonly type?: string;
    readonly destinationIds?: string;
    readonly minPrice?: number;
    readonly maxPrice?: number;
    readonly isFeatured?: true;
    readonly minGuests?: number;
    readonly minBedrooms?: number;
    readonly minBathrooms?: number;
    readonly minRating?: number;
    readonly amenities?: string;
    readonly features?: string;
    readonly includeNoPrice?: false;
    readonly includeNoReviews?: false;
    readonly hasWifi?: true;
    readonly hasPool?: true;
    readonly hasParking?: true;
    readonly allowsPets?: true;
    readonly latitude?: number;
    readonly longitude?: number;
    readonly radius?: number;
    readonly poiId?: string;
    readonly poiSlug?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
}

/** Parsed listing filters shared by the listing pages and the summary. */
export interface ParsedAccommodationListingFilters {
    readonly apiQuery: AccommodationListingApiQuery;
    readonly summaryFilters: AccommodationSummaryFilters;
    /** Allowlisted params (plus sort) as received, for pagination links. `page` is never included. */
    readonly paginationParams: URLSearchParams;
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
    readonly hasPoiRadius: boolean;
    readonly hasGeoRadius: boolean;
    readonly poiIdRaw?: string;
    readonly poiSlugRaw?: string;
    readonly checkIn?: string;
    readonly checkOut?: string;
    readonly availabilityParams: ReturnType<typeof buildAvailabilityParams>;
    readonly minGuests?: number;
}

/**
 * Reads ONLY the allowlisted listing filter params and derives the API query and
 * the summary filters from them. Anything else in the URL is ignored.
 *
 * Coercion and defaults are identical to what the listing pages did inline.
 *
 * @param input.searchParams - The request URL's search params.
 * @param input.ignoreTypeFacet - Skip `types`/`type` (the type is fixed by the URL path).
 * @returns Parsed values, the API query, the summary filters and the pagination params.
 */
export function parseAccommodationListingFilters(input: {
    readonly searchParams: URLSearchParams;
    readonly ignoreTypeFacet?: boolean;
}): ParsedAccommodationListingFilters {
    const raw = new Map<string, string>();
    for (const { param } of ACCOMMODATION_LISTING_FILTER_PARAMS) {
        if (input.ignoreTypeFacet && (param === 'types' || param === 'type')) continue;
        const value = input.searchParams.get(param);
        if (value !== null) raw.set(param, value);
    }
    const text = (key: string): string | undefined => raw.get(key);
    const numeric = (key: string): number | undefined => {
        const value = raw.get(key);
        return value ? Number(value) : undefined;
    };
    const isTrue = (key: string): true | undefined => (raw.get(key) === 'true' ? true : undefined);
    const isFalse = (key: string): false | undefined =>
        raw.get(key) === 'false' ? false : undefined;

    const q = text('q');
    const types = text('types');
    const legacyType = text('type');
    const destinationIds = text('destinationIds');
    const minPrice = numeric('minPrice');
    const maxPrice = numeric('maxPrice');
    const adults = numeric('adults');
    const childrenCount = numeric('children');
    const minBedrooms = numeric('minBedrooms');
    const minBathrooms = numeric('minBathrooms');
    const minRating = numeric('minRating');
    const amenitiesParam = text('amenities');
    const featuresParam = text('features');
    const includeNoPrice = isFalse('includeNoPrice');
    const includeNoReviews = isFalse('includeNoReviews');
    const hasWifi = isTrue('hasWifi');
    const hasPool = isTrue('hasPool');
    const hasParking = isTrue('hasParking');
    const allowsPets = isTrue('allowsPets');
    const isFeatured = isTrue('isFeatured');

    const latitudeRaw = raw.get('latitude');
    const longitudeRaw = raw.get('longitude');
    const radiusRaw = raw.get('radius');
    const latitude = latitudeRaw === undefined ? Number.NaN : Number.parseFloat(latitudeRaw);
    const longitude = longitudeRaw === undefined ? Number.NaN : Number.parseFloat(longitudeRaw);
    const radius = radiusRaw === undefined ? Number.NaN : Number.parseFloat(radiusRaw);
    const hasLatLongRadius =
        Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(radius);

    // `poiId` wins over `poiSlug`, mirroring the server's own precedence.
    const poiIdRaw = text('poiId');
    const poiSlugRaw = poiIdRaw ? undefined : text('poiSlug');
    const hasPoiRadius = Boolean((poiIdRaw || poiSlugRaw) && Number.isFinite(radius));
    const hasGeoRadius = hasLatLongRadius || hasPoiRadius;

    const checkIn = text('checkIn');
    const checkOut = text('checkOut');
    const availabilityParams = buildAvailabilityParams({ checkIn, checkOut });

    const guestCount = (adults ?? 0) + (childrenCount ?? 0);
    const minGuests = guestCount > 0 ? guestCount : undefined;

    const apiQuery: AccommodationListingApiQuery = {
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

    const hasPriceFilter =
        minPrice !== undefined || maxPrice !== undefined || includeNoPrice !== undefined;
    const summaryFilters: AccommodationSummaryFilters = {
        types: (types ?? legacyType)?.split(',').filter(Boolean),
        text: q,
        price: hasPriceFilter
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
        // Described from the VALIDATED pair, never the raw dates: a malformed or
        // inverted range is not sent to the API, so it must not be summarised.
        availability:
            'checkIn' in availabilityParams
                ? { checkIn: availabilityParams.checkIn, checkOut: availabilityParams.checkOut }
                : undefined
    };

    const paginationParams = new URLSearchParams();
    for (const [key, value] of raw) paginationParams.set(key, value);
    for (const key of PAGINATION_CARRIED_CONTROL_PARAMS) {
        const value = input.searchParams.get(key);
        if (value !== null) paginationParams.set(key, value);
    }

    return {
        apiQuery,
        summaryFilters,
        paginationParams,
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
        hasPoiRadius,
        hasGeoRadius,
        poiIdRaw,
        poiSlugRaw,
        checkIn,
        checkOut,
        availabilityParams,
        minGuests
    };
}

/**
 * The `subjectTotal` the summary needs when a type filter is active.
 *
 * When types are active the API already filters by type, so `total` IS the
 * type-specific count. Uses the summary's own types (`types ?? legacyType`) so a
 * legacy `?type=HOTEL` link gets the same subject as `?types=HOTEL`.
 *
 * @param input.summaryFilters - Summary filters from {@link parseAccommodationListingFilters}.
 * @param input.total - Total results reported by the API.
 * @returns `total` when a type filter is active, otherwise `undefined`.
 */
export function resolveSummarySubjectTotal(input: {
    readonly summaryFilters: AccommodationSummaryFilters;
    readonly total: number;
}): number | undefined {
    return (input.summaryFilters.types?.length ?? 0) > 0 ? input.total : undefined;
}
