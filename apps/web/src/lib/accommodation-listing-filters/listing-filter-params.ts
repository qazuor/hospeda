import type { SUMMARY_FILTER_DESCRIPTOR_KEYS } from '../accommodation-listing-summary/summary.descriptors';

/** Summary facets available to allowlisted query parameters. */
export type AccommodationSummaryKey = (typeof SUMMARY_FILTER_DESCRIPTOR_KEYS)[number] | 'types';

/** Single source of truth for filter query parameters and their summary facet. */
export const ACCOMMODATION_LISTING_FILTER_PARAMS = [
    { param: 'q', summaryKey: 'text' },
    { param: 'types', summaryKey: 'types' },
    { param: 'type', summaryKey: 'types' },
    { param: 'destinationIds', summaryKey: 'destination' },
    { param: 'minPrice', summaryKey: 'price' },
    { param: 'maxPrice', summaryKey: 'price' },
    { param: 'includeNoPrice', summaryKey: 'price' },
    { param: 'adults', summaryKey: 'guests' },
    { param: 'children', summaryKey: 'guests' },
    { param: 'minBedrooms', summaryKey: 'bedrooms' },
    { param: 'minBathrooms', summaryKey: 'bathrooms' },
    { param: 'features', summaryKey: 'services' },
    { param: 'amenities', summaryKey: 'amenities' },
    { param: 'hasWifi', summaryKey: 'quickAmenities' },
    { param: 'hasPool', summaryKey: 'quickAmenities' },
    { param: 'hasParking', summaryKey: 'quickAmenities' },
    { param: 'allowsPets', summaryKey: 'quickAmenities' },
    { param: 'minRating', summaryKey: 'rating' },
    { param: 'includeNoReviews', summaryKey: 'rating' },
    { param: 'isFeatured', summaryKey: 'featured' },
    { param: 'latitude', summaryKey: 'location' },
    { param: 'longitude', summaryKey: 'location' },
    { param: 'radius', summaryKey: 'location' },
    { param: 'poiId', summaryKey: 'location' },
    { param: 'poiSlug', summaryKey: 'location' },
    { param: 'checkIn', summaryKey: 'availability' },
    { param: 'checkOut', summaryKey: 'availability' }
] as const satisfies readonly { param: string; summaryKey: AccommodationSummaryKey }[];

/** Legitimate listing controls that do not filter accommodation results. */
export const LISTING_NON_FILTER_PARAMS = ['page', 'sortBy', 'sortOrder'] as const;
