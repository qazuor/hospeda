/**
 * @file listing-empty-state-filters.test.ts
 * @description Regression tests for listing empty-state filter detection.
 */

import { describe, expect, it } from 'vitest';

import {
    hasActiveAccommodationEmptyStateFilters,
    hasActiveExperienceListingFilters,
    hasActiveGastronomyListingFilters,
    normalizeActiveDestinationAttractionIds
} from '@/lib/listing-empty-state-filters';

describe('hasActiveGastronomyListingFilters', () => {
    it('returns false for the bare listing', () => {
        expect(
            hasActiveGastronomyListingFilters({
                q: undefined,
                destinationId: undefined,
                type: undefined,
                priceRange: undefined,
                isFeatured: undefined,
                minRating: undefined
            })
        ).toBe(false);
    });

    it.each([
        { q: 'parrilla' },
        { destinationId: 'dest-1' },
        { type: 'RESTAURANT' },
        { priceRange: 'MID' },
        { isFeatured: true },
        { minRating: 4 }
    ])('returns true when a real gastronomy filter is active: %o', (filters) => {
        expect(
            hasActiveGastronomyListingFilters({
                q: undefined,
                destinationId: undefined,
                type: undefined,
                priceRange: undefined,
                isFeatured: undefined,
                minRating: undefined,
                ...filters
            })
        ).toBe(true);
    });
});

describe('hasActiveExperienceListingFilters', () => {
    it('returns false for the bare listing', () => {
        expect(
            hasActiveExperienceListingFilters({
                q: undefined,
                destinationId: undefined,
                type: undefined,
                isFeatured: undefined,
                minRating: undefined
            })
        ).toBe(false);
    });

    it.each([
        { q: 'kayak' },
        { destinationId: 'dest-1' },
        { type: 'KAYAK_RENTAL' },
        { isFeatured: true },
        { minRating: 5 }
    ])('returns true when a real experience filter is active: %o', (filters) => {
        expect(
            hasActiveExperienceListingFilters({
                q: undefined,
                destinationId: undefined,
                type: undefined,
                isFeatured: undefined,
                minRating: undefined,
                ...filters
            })
        ).toBe(true);
    });
});

describe('hasActiveAccommodationEmptyStateFilters', () => {
    it('returns false for the bare listing and sort-only state', () => {
        expect(
            hasActiveAccommodationEmptyStateFilters({
                q: undefined,
                types: [],
                destinationIds: undefined,
                minPrice: undefined,
                maxPrice: undefined,
                hasWifi: undefined,
                hasPool: undefined,
                hasParking: undefined,
                allowsPets: undefined,
                isFeatured: undefined,
                minBedrooms: undefined,
                minBathrooms: undefined,
                minRating: undefined,
                amenitiesParam: undefined,
                featuresParam: undefined,
                includeNoPrice: undefined,
                includeNoReviews: undefined,
                hasGeoRadius: false,
                hasAvailabilityFilter: false,
                adults: undefined,
                childrenCount: undefined
            })
        ).toBe(false);
    });

    it.each([
        { q: 'hotel' },
        { types: ['HOTEL'] },
        { destinationIds: 'dest-1' },
        { minPrice: 5000 },
        { maxPrice: 10000 },
        { hasWifi: true },
        { hasPool: true },
        { hasParking: true },
        { allowsPets: true },
        { isFeatured: true },
        { minBedrooms: 2 },
        { minBathrooms: 1 },
        { minRating: 4 },
        { amenitiesParam: 'wifi' },
        { featuresParam: 'pool' },
        { includeNoPrice: false },
        { includeNoReviews: false },
        { hasGeoRadius: true },
        { hasAvailabilityFilter: true },
        { adults: 2 },
        { childrenCount: 1 }
    ])('returns true when a real accommodation filter is active: %o', (filters) => {
        expect(
            hasActiveAccommodationEmptyStateFilters({
                q: undefined,
                types: [],
                destinationIds: undefined,
                minPrice: undefined,
                maxPrice: undefined,
                hasWifi: undefined,
                hasPool: undefined,
                hasParking: undefined,
                allowsPets: undefined,
                isFeatured: undefined,
                minBedrooms: undefined,
                minBathrooms: undefined,
                minRating: undefined,
                amenitiesParam: undefined,
                featuresParam: undefined,
                includeNoPrice: undefined,
                includeNoReviews: undefined,
                hasGeoRadius: false,
                hasAvailabilityFilter: false,
                adults: undefined,
                childrenCount: undefined,
                ...filters
            })
        ).toBe(true);
    });

    it('does not count children=0 alone as an active accommodation filter', () => {
        expect(
            hasActiveAccommodationEmptyStateFilters({
                q: undefined,
                types: [],
                destinationIds: undefined,
                minPrice: undefined,
                maxPrice: undefined,
                hasWifi: undefined,
                hasPool: undefined,
                hasParking: undefined,
                allowsPets: undefined,
                isFeatured: undefined,
                minBedrooms: undefined,
                minBathrooms: undefined,
                minRating: undefined,
                amenitiesParam: undefined,
                featuresParam: undefined,
                includeNoPrice: undefined,
                includeNoReviews: undefined,
                hasGeoRadius: false,
                hasAvailabilityFilter: false,
                adults: undefined,
                childrenCount: 0
            })
        ).toBe(false);
    });
});

describe('normalizeActiveDestinationAttractionIds', () => {
    it('drops invalid ids, trims whitespace, and de-duplicates', () => {
        expect(
            normalizeActiveDestinationAttractionIds({
                rawValue: ' beach ,invalid,termas,beach ',
                validIds: ['beach', 'termas', 'rio']
            })
        ).toEqual(['beach', 'termas']);
    });

    it('returns an empty array for an empty or fully invalid value', () => {
        expect(
            normalizeActiveDestinationAttractionIds({
                rawValue: 'invalid,other',
                validIds: ['beach']
            })
        ).toEqual([]);
    });
});
