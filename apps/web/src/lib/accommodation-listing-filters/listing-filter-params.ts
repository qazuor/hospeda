/** Query parameters accepted from public accommodation listing URLs. */
export const ACCOMMODATION_LISTING_FILTER_PARAMS = [
    'q',
    'types',
    'type',
    'destinationIds',
    'minPrice',
    'maxPrice',
    'includeNoPrice',
    'adults',
    'children',
    'minBedrooms',
    'minBathrooms',
    'features',
    'amenities',
    'hasWifi',
    'hasPool',
    'hasParking',
    'allowsPets',
    'minRating',
    'includeNoReviews',
    'isFeatured',
    'latitude',
    'longitude',
    'radius',
    'poiId',
    'poiSlug',
    'checkIn',
    'checkOut'
] as const;

/** Legitimate listing controls that do not filter accommodation results. */
export const LISTING_NON_FILTER_PARAMS = ['page', 'sortBy', 'sortOrder'] as const;
