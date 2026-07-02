/**
 * Tests for scoreCandidateAccommodation / scoreAndRankCandidates (SPEC-284 T-004).
 *
 * Every expected number below is hand-computed in a comment next to the
 * assertion — see spec §5.4 for the component weight table (destination 40,
 * type 20, price 20, amenities 15, quality 5).
 */
import type { RecommendationCandidateAccommodation, RecommendationProfile } from '@repo/schemas';
import { AccommodationTypeEnum, PriceCurrencyEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    DESTINATION_CITY_MATCH_POINTS,
    DESTINATION_COUNTRY_MATCH_POINTS,
    DESTINATION_PROVINCE_MATCH_POINTS,
    DESTINATION_REGION_MATCH_POINTS,
    scoreAndRankCandidates,
    scoreCandidateAccommodation
} from '../../../src/services/recommendation/recommendation.scorer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEST_A = '11111111-1111-4111-8111-111111111111';
const DEST_B = '22222222-2222-4222-8222-222222222222';
const DEST_C = '33333333-3333-4333-8333-333333333333';
const DEST_MISSING = '66666666-6666-4666-8666-666666666666';

const AMENITY_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AMENITY_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AMENITY_3 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const OWNER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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
        ownerId: OWNER_ID,
        isFeatured: false,
        averageRating: 0,
        destinationId: DEST_A,
        amenityIds: [],
        ...overrides
    };
};

/** Builds an empty/neutral profile (safe default for isolating one component). */
const createProfile = (overrides: Partial<RecommendationProfile> = {}): RecommendationProfile => ({
    preferredDestinations: [],
    preferredTypes: [],
    priceRange: { min: null, max: null },
    frequentAmenities: [],
    isCold: false,
    ...overrides
});

// ---------------------------------------------------------------------------
// Destination component (0-40, spec §5.4)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — destination component (0-40, spec §5.4)', () => {
    it('awards DESTINATION_CITY_MATCH_POINTS when paths match through the city level (commonPrefixLength >= 5)', () => {
        const cityPath = '/argentina/litoral/entre-rios/concepcion-dept/concepcion-del-uruguay';
        const candidate = createCandidate({ destinationId: DEST_A });
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });
        const destinationPaths = { [DEST_A]: cityPath, [DEST_B]: cityPath };

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_CITY_MATCH_POINTS);
        expect(DESTINATION_CITY_MATCH_POINTS).toBe(40);
    });

    it('awards DESTINATION_PROVINCE_MATCH_POINTS when paths match through department only (commonPrefixLength === 4)', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: '/argentina/litoral/entre-rios/concepcion-dept/concepcion-del-uruguay',
            [DEST_B]: '/argentina/litoral/entre-rios/concepcion-dept/otra-ciudad'
        };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_PROVINCE_MATCH_POINTS);
        expect(DESTINATION_PROVINCE_MATCH_POINTS).toBe(24);
    });

    it('awards DESTINATION_PROVINCE_MATCH_POINTS when paths match through province only (commonPrefixLength === 3)', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: '/argentina/litoral/entre-rios/concepcion-dept/concepcion-del-uruguay',
            [DEST_B]: '/argentina/litoral/entre-rios/otro-depto/otra-ciudad'
        };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_PROVINCE_MATCH_POINTS);
    });

    it('awards DESTINATION_REGION_MATCH_POINTS when paths match through region only (commonPrefixLength === 2)', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: '/argentina/litoral/entre-rios',
            [DEST_B]: '/argentina/litoral/corrientes'
        };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_REGION_MATCH_POINTS);
        expect(DESTINATION_REGION_MATCH_POINTS).toBe(12);
    });

    it('awards DESTINATION_COUNTRY_MATCH_POINTS when paths match through country only (commonPrefixLength === 1)', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: '/argentina/litoral',
            [DEST_B]: '/argentina/pampa'
        };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_COUNTRY_MATCH_POINTS);
        expect(DESTINATION_COUNTRY_MATCH_POINTS).toBe(4);
    });

    it('awards 0 when paths share no common prefix (commonPrefixLength === 0)', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: '/argentina/litoral',
            [DEST_B]: '/uruguay/este'
        };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(0);
    });

    it('awards 0 when the candidate destination is empty', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = { [DEST_A]: '/argentina/litoral' };
        const profile = createProfile({ preferredDestinations: [] });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(0);
    });

    it('awards 0 without crashing when the candidate path is missing from destinationPaths', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = { [DEST_B]: '/argentina/litoral' };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(0);
    });

    it('awards 0 without crashing when a preferred destination path is missing from destinationPaths', () => {
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = { [DEST_A]: '/argentina/litoral' };
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_MISSING, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(0);
    });

    it('takes the MAX tier across multiple preferred destinations, not an average', () => {
        const cityPath = '/argentina/litoral/entre-rios/concepcion-dept/concepcion-del-uruguay';
        const candidate = createCandidate({ destinationId: DEST_A });
        const destinationPaths = {
            [DEST_A]: cityPath,
            // DEST_B matches the candidate exactly -> city tier (40)
            [DEST_B]: cityPath,
            // DEST_C only shares the country segment -> country tier (4)
            [DEST_C]: '/argentina/pampa'
        };
        const profile = createProfile({
            preferredDestinations: [
                { destinationId: DEST_C, weight: 10 },
                { destinationId: DEST_B, weight: 1 }
            ]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        expect(result.score.destination).toBe(DESTINATION_CITY_MATCH_POINTS);
    });
});

// ---------------------------------------------------------------------------
// Type component (0-20, spec §5.4)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — type component (0-20, spec §5.4)', () => {
    it('awards full 20 when the only preferred type matches the candidate type', () => {
        const candidate = createCandidate({ type: AccommodationTypeEnum.CABIN });
        const profile = createProfile({
            preferredTypes: [{ type: AccommodationTypeEnum.CABIN, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // matchingWeight / totalWeight * 20 = 5/5 * 20 = 20
        expect(result.score.type).toBe(20);
    });

    it('awards 0 when no preferred type matches the candidate type', () => {
        const candidate = createCandidate({ type: AccommodationTypeEnum.HOTEL });
        const profile = createProfile({
            preferredTypes: [{ type: AccommodationTypeEnum.CABIN, weight: 5 }]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.type).toBe(0);
    });

    it('awards 0 when preferredTypes is empty (guards divide-by-zero)', () => {
        const candidate = createCandidate({ type: AccommodationTypeEnum.CABIN });
        const profile = createProfile({ preferredTypes: [] });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.type).toBe(0);
    });

    it('scales proportionally to the matching type weight vs total weight', () => {
        const candidate = createCandidate({ type: AccommodationTypeEnum.HOUSE });
        const profile = createProfile({
            preferredTypes: [
                { type: AccommodationTypeEnum.CABIN, weight: 1 },
                { type: AccommodationTypeEnum.HOUSE, weight: 3 }
            ]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // matchingWeight / totalWeight * 20 = 3/4 * 20 = 15
        expect(result.score.type).toBe(15);
    });
});

// ---------------------------------------------------------------------------
// Price component (0-20, spec §5.4)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — price component (0-20, spec §5.4)', () => {
    it('awards full 20 when the candidate price falls inside the range', () => {
        const candidate = createCandidate({
            price: { price: 15000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(20);
    });

    it('applies linear decay when the price is below the range', () => {
        const candidate = createCandidate({
            price: { price: 5000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // rangeWidth = 20000-10000 = 10000; distance = 10000-5000 = 5000
        // score = 20 * (1 - 5000/(2*10000)) = 20 * 0.75 = 15
        expect(result.score.price).toBe(15);
    });

    it('applies linear decay when the price is above the range', () => {
        const candidate = createCandidate({
            price: { price: 27000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // rangeWidth = 10000; distance = 27000-20000 = 7000
        // score = 20 * (1 - 7000/20000) = 20 * 0.65 = 13
        expect(result.score.price).toBe(13);
    });

    it('decays fully to 0 once the distance reaches 2x the range width', () => {
        const candidate = createCandidate({
            price: { price: 45000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // rangeWidth = 10000; distance = 25000 >= 2*10000 -> clamped to 0
        expect(result.score.price).toBe(0);
    });

    it('returns the neutral half-credit (10) when the candidate has no price', () => {
        const candidate = createCandidate({ price: undefined });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(10);
    });

    it('returns the neutral half-credit (10) when the profile has no price signal', () => {
        const candidate = createCandidate({
            price: { price: 15000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({ priceRange: { min: null, max: null } });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(10);
    });

    it('returns the neutral half-credit (10) on a currency mismatch', () => {
        const candidate = createCandidate({
            price: { price: 15000, currency: PriceCurrencyEnum.USD }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(10);
    });

    it('treats a min-only range as unbounded upward (full credit above min)', () => {
        const candidate = createCandidate({
            price: { price: 50000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: null, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(20);
    });

    it('decays from a min-only bound when the price falls below it', () => {
        const candidate = createCandidate({
            price: { price: 8000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 10000, max: null, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // width = max(min, 1) = 10000; distance = 10000-8000 = 2000
        // score = 20 * (1 - 2000/(2*10000)) = 20 * 0.9 = 18
        expect(result.score.price).toBe(18);
    });

    it('treats a max-only range as unbounded downward (full credit below max)', () => {
        const candidate = createCandidate({
            price: { price: 5000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: null, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(20);
    });

    it('decays from a max-only bound when the price rises above it', () => {
        const candidate = createCandidate({
            price: { price: 25000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: null, max: 20000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // width = max(max, 1) = 20000; distance = 25000-20000 = 5000
        // score = 20 * (1 - 5000/(2*20000)) = 20 * 0.875 = 17.5
        expect(result.score.price).toBe(17.5);
    });

    it('awards full 20 for an exact match against a degenerate min===max range', () => {
        const candidate = createCandidate({
            price: { price: 15000, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 15000, max: 15000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.price).toBe(20);
    });

    it('decays quickly off a degenerate min===max range using the epsilon width floor', () => {
        const candidate = createCandidate({
            price: { price: 15001, currency: PriceCurrencyEnum.ARS }
        });
        const profile = createProfile({
            priceRange: { min: 15000, max: 15000, currency: PriceCurrencyEnum.ARS }
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // rangeWidth = max(15000-15000, 1) = 1; distance = 1
        // score = 20 * (1 - 1/(2*1)) = 20 * 0.5 = 10
        expect(result.score.price).toBe(10);
    });
});

// ---------------------------------------------------------------------------
// Amenities component (0-15, spec §5.4)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — amenities component (0-15, spec §5.4)', () => {
    it('awards full 15 on full overlap (Jaccard = 1)', () => {
        const candidate = createCandidate({ amenityIds: [AMENITY_1, AMENITY_2] });
        const profile = createProfile({
            frequentAmenities: [
                { amenityId: AMENITY_1, weight: 3 },
                { amenityId: AMENITY_2, weight: 1 }
            ]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.amenities).toBe(15);
    });

    it('awards a proportional score on partial overlap', () => {
        const candidate = createCandidate({ amenityIds: [AMENITY_1, AMENITY_2] });
        const profile = createProfile({
            frequentAmenities: [
                { amenityId: AMENITY_1, weight: 3 },
                { amenityId: AMENITY_3, weight: 2 }
            ]
        });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // intersection = {AMENITY_1} = 1; union = {A1,A2,A3} = 3
        // score = 15 * (1/3) = 5
        expect(result.score.amenities).toBe(5);
    });

    it('awards 0 on no overlap', () => {
        const candidate = createCandidate({ amenityIds: [AMENITY_1] });
        const profile = createProfile({ frequentAmenities: [{ amenityId: AMENITY_2, weight: 1 }] });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.amenities).toBe(0);
    });

    it('awards 0 without NaN when both sets are empty (guards divide-by-zero)', () => {
        const candidate = createCandidate({ amenityIds: [] });
        const profile = createProfile({ frequentAmenities: [] });

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.amenities).toBe(0);
        expect(Number.isNaN(result.score.amenities)).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Quality component (0-5, spec §5.4)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — quality component (0-5, spec §5.4)', () => {
    it('awards the full 5 for a max rating plus featured bonus (capped)', () => {
        const candidate = createCandidate({ averageRating: 5, isFeatured: true });
        const profile = createProfile();

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // ratingPortion = (5/5)*4 = 4; featuredBonus = 1; total = 5 (== cap)
        expect(result.score.quality).toBe(5);
    });

    it('awards 0 for a zero rating and not featured', () => {
        const candidate = createCandidate({ averageRating: 0, isFeatured: false });
        const profile = createProfile();

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        expect(result.score.quality).toBe(0);
    });

    it('awards only the rating portion when not featured', () => {
        const candidate = createCandidate({ averageRating: 2.5, isFeatured: false });
        const profile = createProfile();

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // ratingPortion = (2.5/5)*4 = 2; featuredBonus = 0
        expect(result.score.quality).toBe(2);
    });

    it('awards only the featured bonus when rating is zero', () => {
        const candidate = createCandidate({ averageRating: 0, isFeatured: true });
        const profile = createProfile();

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths: {} });

        // ratingPortion = 0; featuredBonus = 1
        expect(result.score.quality).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// End-to-end (hand-computed totalScore)
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — end-to-end multi-component (hand-computed)', () => {
    it('computes a hand-computed totalScore across all five components', () => {
        const cityPath = '/argentina/litoral/entre-rios/concepcion-dept/concepcion-del-uruguay';
        const candidate = createCandidate({
            destinationId: DEST_A,
            type: AccommodationTypeEnum.CABIN,
            price: { price: 12000, currency: PriceCurrencyEnum.ARS },
            amenityIds: [AMENITY_1, AMENITY_2, AMENITY_3],
            averageRating: 4,
            isFeatured: true
        });
        const profile = createProfile({
            preferredDestinations: [{ destinationId: DEST_B, weight: 5 }],
            preferredTypes: [
                { type: AccommodationTypeEnum.CABIN, weight: 8 },
                { type: AccommodationTypeEnum.HOUSE, weight: 2 }
            ],
            priceRange: { min: 10000, max: 20000, currency: PriceCurrencyEnum.ARS },
            frequentAmenities: [
                { amenityId: AMENITY_1, weight: 5 },
                { amenityId: AMENITY_2, weight: 3 }
            ]
        });
        const destinationPaths = { [DEST_A]: cityPath, [DEST_B]: cityPath };

        const result = scoreCandidateAccommodation({ candidate, profile, destinationPaths });

        // destination: exact path match -> city tier = 40
        expect(result.score.destination).toBe(40);
        // type: 8/10 * 20 = 16
        expect(result.score.type).toBe(16);
        // price: 12000 inside [10000,20000] -> 20
        expect(result.score.price).toBe(20);
        // amenities: intersection {A1,A2}=2, union {A1,A2,A3}=3 -> 15*(2/3) = 10
        expect(result.score.amenities).toBe(10);
        // quality: ratingPortion (4/5)*4=3.2, featuredBonus=1 -> 4.2
        expect(result.score.quality).toBeCloseTo(4.2, 10);
        // totalScore = 40+16+20+10+4.2 = 90.2
        expect(result.totalScore).toBeCloseTo(90.2, 10);
        // ScoredAccommodationSchema.parse applies the schema's `reviewsCount`
        // default (0) since the fixture omits it — the rest passes through untouched.
        expect(result.accommodation).toEqual({ ...candidate, reviewsCount: 0 });
    });
});

// ---------------------------------------------------------------------------
// Cold/empty profile does not throw
// ---------------------------------------------------------------------------

describe('scoreCandidateAccommodation — cold/empty profile', () => {
    it('does not throw and yields low/zero scores when called against a cold profile', () => {
        const candidate = createCandidate({
            averageRating: 0,
            isFeatured: false,
            amenityIds: [AMENITY_1]
        });
        const coldProfile: RecommendationProfile = {
            preferredDestinations: [],
            preferredTypes: [],
            priceRange: { min: null, max: null },
            frequentAmenities: [],
            isCold: true
        };

        expect(() =>
            scoreCandidateAccommodation({ candidate, profile: coldProfile, destinationPaths: {} })
        ).not.toThrow();

        const result = scoreCandidateAccommodation({
            candidate,
            profile: coldProfile,
            destinationPaths: {}
        });

        expect(result.score.destination).toBe(0);
        expect(result.score.type).toBe(0);
        expect(result.score.price).toBe(10); // neutral half-credit, no price signal
        expect(result.score.amenities).toBe(0); // profile has no frequent amenities
        expect(result.score.quality).toBe(0);
        expect(result.totalScore).toBe(10);
    });
});

// ---------------------------------------------------------------------------
// scoreAndRankCandidates
// ---------------------------------------------------------------------------

describe('scoreAndRankCandidates', () => {
    it('sorts candidates by totalScore descending', () => {
        const profile = createProfile({
            preferredTypes: [{ type: AccommodationTypeEnum.CABIN, weight: 1 }]
        });
        const fullMatch = createCandidate({ type: AccommodationTypeEnum.CABIN }); // type=20 + price neutral 10 = 30
        const noMatch = createCandidate({ type: AccommodationTypeEnum.HOTEL }); // type=0 + price neutral 10 = 10

        const results = scoreAndRankCandidates({
            candidates: [noMatch, fullMatch],
            profile,
            destinationPaths: {}
        });

        expect(results.map((r) => r.accommodation.id)).toEqual([fullMatch.id, noMatch.id]);
        expect(results[0]?.totalScore).toBe(30);
        expect(results[1]?.totalScore).toBe(10);
    });

    it('preserves input order for candidates with equal totalScore (stable sort)', () => {
        const profile = createProfile();
        const first = createCandidate();
        const second = createCandidate();
        const third = createCandidate();

        const results = scoreAndRankCandidates({
            candidates: [first, second, third],
            profile,
            destinationPaths: {}
        });

        expect(results.map((r) => r.accommodation.id)).toEqual([first.id, second.id, third.id]);
    });

    it('returns an empty array for an empty candidate list', () => {
        const profile = createProfile();

        const results = scoreAndRankCandidates({ candidates: [], profile, destinationPaths: {} });

        expect(results).toEqual([]);
    });
});
