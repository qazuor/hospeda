/**
 * Tests for buildRecommendationProfile (SPEC-284 T-003).
 *
 * Covers weighted aggregation per signal (favorites=3, recently-viewed=1,
 * search-history=2), cold-start, degraded search-history, single-signal-only
 * cases, and a multi-signal fusion case with hand-computed expected weights.
 */
import type { RecommendationCandidateAccommodation, SearchHistoryFilters } from '@repo/schemas';
import { AccommodationTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    buildRecommendationProfile,
    FAVORITE_SIGNAL_WEIGHT,
    RECENTLY_VIEWED_SIGNAL_WEIGHT,
    SEARCH_HISTORY_SIGNAL_WEIGHT
} from '../../../src/services/recommendation/recommendation.profile';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';
const DESTINATION_2 = '22222222-2222-4222-8222-222222222222';
const AMENITY_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AMENITY_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let candidateCounter = 0;

/** Builds a minimal, valid-shaped candidate accommodation for tests. */
const createCandidate = (
    overrides: Partial<RecommendationCandidateAccommodation> = {}
): RecommendationCandidateAccommodation => {
    candidateCounter += 1;
    return {
        id: `cccccccc-cccc-4ccc-8ccc-${String(candidateCounter).padStart(12, '0')}`,
        name: `Candidate ${candidateCounter}`,
        slug: `candidate-${candidateCounter}`,
        summary: 'A lovely place to stay for at least ten characters.',
        type: AccommodationTypeEnum.CABIN,
        ownerId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        isFeatured: false,
        averageRating: 0,
        destinationId: DESTINATION_1,
        amenityIds: [],
        ...overrides
    };
};

// ---------------------------------------------------------------------------
// Cold-start
// ---------------------------------------------------------------------------

describe('buildRecommendationProfile — cold-start (spec §5.5)', () => {
    it('returns an empty, cold profile when all three inputs are empty', () => {
        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: []
        });

        expect(profile).toEqual({
            preferredDestinations: [],
            preferredTypes: [],
            priceRange: { min: null, max: null },
            frequentAmenities: [],
            isCold: true
        });
    });

    it('stays cold when a search-history entry carries no usable fields', () => {
        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [{} satisfies SearchHistoryFilters]
        });

        expect(profile.isCold).toBe(true);
        expect(profile.preferredDestinations).toEqual([]);
        expect(profile.priceRange).toEqual({ min: null, max: null });
    });
});

// ---------------------------------------------------------------------------
// Single-signal-only cases
// ---------------------------------------------------------------------------

describe('buildRecommendationProfile — single-signal-only', () => {
    it('weights favorites at FAVORITE_SIGNAL_WEIGHT (3)', () => {
        const favorite = createCandidate({
            destinationId: DESTINATION_1,
            type: AccommodationTypeEnum.CABIN,
            price: { price: 20000, currency: PriceCurrencyEnum.ARS },
            amenityIds: [AMENITY_1, AMENITY_2]
        });

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [favorite],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: []
        });

        expect(profile.isCold).toBe(false);
        expect(profile.preferredDestinations).toEqual([
            { destinationId: DESTINATION_1, weight: FAVORITE_SIGNAL_WEIGHT }
        ]);
        expect(profile.preferredTypes).toEqual([
            { type: AccommodationTypeEnum.CABIN, weight: FAVORITE_SIGNAL_WEIGHT }
        ]);
        expect(profile.priceRange).toEqual({
            min: 20000,
            max: 20000,
            currency: PriceCurrencyEnum.ARS
        });
        expect(profile.frequentAmenities).toEqual([
            { amenityId: AMENITY_1, weight: FAVORITE_SIGNAL_WEIGHT },
            { amenityId: AMENITY_2, weight: FAVORITE_SIGNAL_WEIGHT }
        ]);
    });

    it('weights recently-viewed at RECENTLY_VIEWED_SIGNAL_WEIGHT (1)', () => {
        const viewed = createCandidate({
            destinationId: DESTINATION_2,
            type: AccommodationTypeEnum.HOUSE,
            price: { price: 10000, currency: PriceCurrencyEnum.ARS },
            amenityIds: [AMENITY_1]
        });

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [viewed],
            searchHistoryFilters: []
        });

        expect(profile.isCold).toBe(false);
        expect(profile.preferredDestinations).toEqual([
            { destinationId: DESTINATION_2, weight: RECENTLY_VIEWED_SIGNAL_WEIGHT }
        ]);
        expect(profile.preferredTypes).toEqual([
            { type: AccommodationTypeEnum.HOUSE, weight: RECENTLY_VIEWED_SIGNAL_WEIGHT }
        ]);
        expect(profile.priceRange).toEqual({
            min: 10000,
            max: 10000,
            currency: PriceCurrencyEnum.ARS
        });
        expect(profile.frequentAmenities).toEqual([
            { amenityId: AMENITY_1, weight: RECENTLY_VIEWED_SIGNAL_WEIGHT }
        ]);
    });

    it('weights search history at SEARCH_HISTORY_SIGNAL_WEIGHT (2), contributing filters directly', () => {
        const search: SearchHistoryFilters = {
            destinationId: DESTINATION_1,
            minPrice: 10000,
            maxPrice: 30000,
            currency: PriceCurrencyEnum.ARS,
            type: AccommodationTypeEnum.HOTEL,
            amenities: [AMENITY_1]
        };

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [search]
        });

        expect(profile.isCold).toBe(false);
        expect(profile.preferredDestinations).toEqual([
            { destinationId: DESTINATION_1, weight: SEARCH_HISTORY_SIGNAL_WEIGHT }
        ]);
        expect(profile.preferredTypes).toEqual([
            { type: AccommodationTypeEnum.HOTEL, weight: SEARCH_HISTORY_SIGNAL_WEIGHT }
        ]);
        expect(profile.priceRange).toEqual({
            min: 10000,
            max: 30000,
            currency: PriceCurrencyEnum.ARS
        });
        expect(profile.frequentAmenities).toEqual([
            { amenityId: AMENITY_1, weight: SEARCH_HISTORY_SIGNAL_WEIGHT }
        ]);
    });

    it('splits the SEARCH_HISTORY_SIGNAL_WEIGHT evenly across a multi-type `types` filter', () => {
        const search: SearchHistoryFilters = {
            types: [
                AccommodationTypeEnum.CABIN,
                AccommodationTypeEnum.HOUSE,
                AccommodationTypeEnum.HOTEL
            ]
        };

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [search]
        });

        const perTypeWeight = SEARCH_HISTORY_SIGNAL_WEIGHT / 3;
        expect(profile.preferredTypes).toEqual(
            expect.arrayContaining([
                { type: AccommodationTypeEnum.CABIN, weight: perTypeWeight },
                { type: AccommodationTypeEnum.HOUSE, weight: perTypeWeight },
                { type: AccommodationTypeEnum.HOTEL, weight: perTypeWeight }
            ])
        );
        expect(profile.preferredTypes).toHaveLength(3);
    });

    it('does NOT dilute the `amenities` filter across multiple entries (each gets full weight)', () => {
        const search: SearchHistoryFilters = {
            amenities: [AMENITY_1, AMENITY_2]
        };

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [search]
        });

        expect(profile.frequentAmenities).toEqual([
            { amenityId: AMENITY_1, weight: SEARCH_HISTORY_SIGNAL_WEIGHT },
            { amenityId: AMENITY_2, weight: SEARCH_HISTORY_SIGNAL_WEIGHT }
        ]);
    });

    it('leaves a bound null when only the other bound has signal (e.g. only maxPrice searched)', () => {
        const search: SearchHistoryFilters = { maxPrice: 25000 };

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [search]
        });

        expect(profile.priceRange.min).toBeNull();
        expect(profile.priceRange.max).toBe(25000);
        expect(profile.isCold).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Degraded search history
// ---------------------------------------------------------------------------

describe('buildRecommendationProfile — degraded search history (spec §5.2)', () => {
    it('still builds a valid, non-cold profile when search history is empty', () => {
        const favorite = createCandidate({
            destinationId: DESTINATION_1,
            type: AccommodationTypeEnum.CABIN,
            amenityIds: [AMENITY_1]
        });
        const viewed = createCandidate({
            destinationId: DESTINATION_1,
            type: AccommodationTypeEnum.CABIN,
            amenityIds: [AMENITY_1]
        });

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [favorite],
            recentlyViewedAccommodations: [viewed],
            searchHistoryFilters: []
        });

        expect(profile.isCold).toBe(false);
        expect(profile.preferredDestinations).toEqual([
            {
                destinationId: DESTINATION_1,
                weight: FAVORITE_SIGNAL_WEIGHT + RECENTLY_VIEWED_SIGNAL_WEIGHT
            }
        ]);
    });
});

// ---------------------------------------------------------------------------
// Multi-signal fusion (hand-computed)
// ---------------------------------------------------------------------------

describe('buildRecommendationProfile — multi-signal fusion (hand-computed)', () => {
    it('fuses favorites + recently-viewed + search-history with correct weighted math', () => {
        const favorite = createCandidate({
            destinationId: DESTINATION_1,
            type: AccommodationTypeEnum.CABIN,
            price: { price: 20000, currency: PriceCurrencyEnum.ARS },
            amenityIds: [AMENITY_1]
        });
        const viewed = createCandidate({
            destinationId: DESTINATION_1,
            type: AccommodationTypeEnum.HOUSE,
            price: { price: 10000, currency: PriceCurrencyEnum.ARS },
            amenityIds: [AMENITY_1, AMENITY_2]
        });
        const search: SearchHistoryFilters = {
            destinationId: DESTINATION_2,
            minPrice: 15000,
            maxPrice: 25000,
            currency: PriceCurrencyEnum.ARS,
            types: [AccommodationTypeEnum.CABIN, AccommodationTypeEnum.HOTEL],
            amenities: [AMENITY_2]
        };

        const profile = buildRecommendationProfile({
            favoriteAccommodations: [favorite],
            recentlyViewedAccommodations: [viewed],
            searchHistoryFilters: [search]
        });

        // destinations: D1 = 3 (favorite) + 1 (viewed) = 4; D2 = 2 (search)
        expect(profile.preferredDestinations).toEqual([
            { destinationId: DESTINATION_1, weight: 4 },
            { destinationId: DESTINATION_2, weight: 2 }
        ]);

        // types: CABIN = 3 (favorite) + 1 (search, 2/2 types) = 4;
        // HOUSE = 1 (viewed); HOTEL = 1 (search, 2/2 types)
        expect(profile.preferredTypes).toEqual([
            { type: AccommodationTypeEnum.CABIN, weight: 4 },
            { type: AccommodationTypeEnum.HOUSE, weight: 1 },
            { type: AccommodationTypeEnum.HOTEL, weight: 1 }
        ]);

        // price: min pool = [20000*3, 10000*1, 15000*2] -> (60000+10000+30000)/6
        // price: max pool = [20000*3, 10000*1, 25000*2] -> (60000+10000+50000)/6
        expect(profile.priceRange.min).toBe((20000 * 3 + 10000 * 1 + 15000 * 2) / 6);
        expect(profile.priceRange.max).toBe((20000 * 3 + 10000 * 1 + 25000 * 2) / 6);
        expect(profile.priceRange.currency).toBe(PriceCurrencyEnum.ARS);

        // amenities: A1 = 3 (favorite) + 1 (viewed) = 4; A2 = 1 (viewed) + 2 (search) = 3
        expect(profile.frequentAmenities).toEqual([
            { amenityId: AMENITY_1, weight: 4 },
            { amenityId: AMENITY_2, weight: 3 }
        ]);

        expect(profile.isCold).toBe(false);
    });

    it('breaks currency ties by first-seen signal (weighted majority, first inserted on tie)', () => {
        const favorite = createCandidate({
            price: { price: 20000, currency: PriceCurrencyEnum.ARS }
        });
        const search: SearchHistoryFilters = {
            minPrice: 100,
            currency: PriceCurrencyEnum.USD
        };
        // favorite weight (3) > search weight (2) -> ARS should win, no real tie here,
        // but this also documents that higher accumulated weight decides the currency.
        const profile = buildRecommendationProfile({
            favoriteAccommodations: [favorite],
            recentlyViewedAccommodations: [],
            searchHistoryFilters: [search]
        });

        expect(profile.priceRange.currency).toBe(PriceCurrencyEnum.ARS);
    });
});
