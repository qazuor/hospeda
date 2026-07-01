import { describe, expect, it } from 'vitest';
import { AccommodationSummarySchema } from '../../../src/entities/accommodation/accommodation.query.schema.js';
import {
    AccommodationTypePreferenceSchema,
    AmenityPreferenceSchema,
    DestinationPreferenceSchema,
    PricePreferenceSchema,
    RecommendationCandidateAccommodationSchema,
    RecommendationFeedResponseSchema,
    RecommendationProfileSchema,
    RecommendationScoreBreakdownSchema,
    ScoredAccommodationSchema
} from '../../../src/entities/recommendation/recommendation.schema.js';
import { createValidAccommodation } from '../../fixtures/accommodation.fixtures.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DESTINATION_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const AMENITY_UUID = 'c0ffee00-dead-4bee-beef-feedfacecafe';

/**
 * Builds a valid {@link RecommendationCandidateAccommodation}-shaped fixture by
 * parsing a full accommodation fixture through `AccommodationSummarySchema`
 * (single source of truth for the accommodation fields) and adding the two
 * scorer-only fields the summary projection omits.
 */
const createCandidateFixture = (overrides: Record<string, unknown> = {}) => {
    const summary = AccommodationSummarySchema.parse(createValidAccommodation());
    return {
        ...summary,
        destinationId: DESTINATION_UUID,
        amenityIds: [AMENITY_UUID],
        ...overrides
    };
};

const createScoreBreakdownFixture = (
    overrides: Partial<{
        destination: number;
        type: number;
        price: number;
        amenities: number;
        quality: number;
    }> = {}
) => ({
    destination: 40,
    type: 20,
    price: 14,
    amenities: 9,
    quality: 5,
    ...overrides
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DestinationPreferenceSchema', () => {
    it('should parse a valid destination preference', () => {
        const result = DestinationPreferenceSchema.safeParse({
            destinationId: DESTINATION_UUID,
            weight: 7
        });
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID destinationId', () => {
        const result = DestinationPreferenceSchema.safeParse({
            destinationId: 'not-a-uuid',
            weight: 7
        });
        expect(result.success).toBe(false);
    });

    it('should reject a negative weight', () => {
        const result = DestinationPreferenceSchema.safeParse({
            destinationId: DESTINATION_UUID,
            weight: -1
        });
        expect(result.success).toBe(false);
    });
});

describe('AccommodationTypePreferenceSchema', () => {
    it('should parse a valid accommodation type preference', () => {
        const result = AccommodationTypePreferenceSchema.safeParse({
            type: 'CABIN',
            weight: 4
        });
        expect(result.success).toBe(true);
    });

    it('should reject an unknown accommodation type', () => {
        const result = AccommodationTypePreferenceSchema.safeParse({
            type: 'SPACESHIP',
            weight: 4
        });
        expect(result.success).toBe(false);
    });
});

describe('PricePreferenceSchema', () => {
    it('should parse a valid price range', () => {
        const result = PricePreferenceSchema.safeParse({
            min: 15000,
            max: 40000,
            currency: 'ARS'
        });
        expect(result.success).toBe(true);
    });

    it('should accept null bounds (no price signal)', () => {
        const result = PricePreferenceSchema.safeParse({ min: null, max: null });
        expect(result.success).toBe(true);
    });

    it('should reject a negative min bound', () => {
        const result = PricePreferenceSchema.safeParse({ min: -100, max: 1000 });
        expect(result.success).toBe(false);
    });

    it('should reject a missing min field', () => {
        const result = PricePreferenceSchema.safeParse({ max: 1000 });
        expect(result.success).toBe(false);
    });
});

describe('AmenityPreferenceSchema', () => {
    it('should parse a valid amenity preference', () => {
        const result = AmenityPreferenceSchema.safeParse({
            amenityId: AMENITY_UUID,
            weight: 2
        });
        expect(result.success).toBe(true);
    });

    it('should reject a non-UUID amenityId', () => {
        const result = AmenityPreferenceSchema.safeParse({
            amenityId: 'not-a-uuid',
            weight: 2
        });
        expect(result.success).toBe(false);
    });
});

describe('RecommendationProfileSchema', () => {
    it('should parse a complete non-cold profile', () => {
        const result = RecommendationProfileSchema.safeParse({
            preferredDestinations: [{ destinationId: DESTINATION_UUID, weight: 7 }],
            preferredTypes: [{ type: 'CABIN', weight: 4 }],
            priceRange: { min: 15000, max: 40000, currency: 'ARS' },
            frequentAmenities: [{ amenityId: AMENITY_UUID, weight: 2 }],
            isCold: false
        });
        expect(result.success).toBe(true);
    });

    it('should parse a cold profile with empty preference lists and null price bounds', () => {
        const result = RecommendationProfileSchema.safeParse({
            preferredDestinations: [],
            preferredTypes: [],
            priceRange: { min: null, max: null },
            frequentAmenities: [],
            isCold: true
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isCold).toBe(true);
        }
    });

    it('should reject a profile missing isCold', () => {
        const result = RecommendationProfileSchema.safeParse({
            preferredDestinations: [],
            preferredTypes: [],
            priceRange: { min: null, max: null },
            frequentAmenities: []
        });
        expect(result.success).toBe(false);
    });

    it('should reject a profile with a malformed preference entry', () => {
        const result = RecommendationProfileSchema.safeParse({
            preferredDestinations: [{ destinationId: 'not-a-uuid', weight: 7 }],
            preferredTypes: [],
            priceRange: { min: null, max: null },
            frequentAmenities: [],
            isCold: false
        });
        expect(result.success).toBe(false);
    });
});

describe('RecommendationScoreBreakdownSchema', () => {
    it('should parse a valid score breakdown', () => {
        const result = RecommendationScoreBreakdownSchema.safeParse(createScoreBreakdownFixture());
        expect(result.success).toBe(true);
    });

    it('should reject a destination component above its 40-point cap', () => {
        const result = RecommendationScoreBreakdownSchema.safeParse(
            createScoreBreakdownFixture({ destination: 41 })
        );
        expect(result.success).toBe(false);
    });

    it('should reject a negative amenities component', () => {
        const result = RecommendationScoreBreakdownSchema.safeParse(
            createScoreBreakdownFixture({ amenities: -1 })
        );
        expect(result.success).toBe(false);
    });

    it('should reject a quality component above its 5-point cap', () => {
        const result = RecommendationScoreBreakdownSchema.safeParse(
            createScoreBreakdownFixture({ quality: 6 })
        );
        expect(result.success).toBe(false);
    });
});

describe('RecommendationCandidateAccommodationSchema', () => {
    it('should parse a valid candidate accommodation', () => {
        const result = RecommendationCandidateAccommodationSchema.safeParse(
            createCandidateFixture()
        );
        expect(result.success).toBe(true);
    });

    it('should accept an empty amenityIds array (accommodation with no amenities)', () => {
        const result = RecommendationCandidateAccommodationSchema.safeParse(
            createCandidateFixture({ amenityIds: [] })
        );
        expect(result.success).toBe(true);
    });

    it('should reject a candidate missing destinationId', () => {
        const { destinationId: _unused, ...withoutDestination } = createCandidateFixture();
        const result = RecommendationCandidateAccommodationSchema.safeParse(withoutDestination);
        expect(result.success).toBe(false);
    });

    it('should reject a candidate with a non-UUID amenityId', () => {
        const result = RecommendationCandidateAccommodationSchema.safeParse(
            createCandidateFixture({ amenityIds: ['not-a-uuid'] })
        );
        expect(result.success).toBe(false);
    });
});

describe('ScoredAccommodationSchema', () => {
    it('should parse a valid scored accommodation', () => {
        const result = ScoredAccommodationSchema.safeParse({
            accommodation: createCandidateFixture(),
            score: createScoreBreakdownFixture(),
            totalScore: 88
        });
        expect(result.success).toBe(true);
    });

    it('should reject a totalScore above 100', () => {
        const result = ScoredAccommodationSchema.safeParse({
            accommodation: createCandidateFixture(),
            score: createScoreBreakdownFixture(),
            totalScore: 101
        });
        expect(result.success).toBe(false);
    });

    it('should reject a scored accommodation with an invalid nested candidate', () => {
        const { destinationId: _unused, ...invalidCandidate } = createCandidateFixture();
        const result = ScoredAccommodationSchema.safeParse({
            accommodation: invalidCandidate,
            score: createScoreBreakdownFixture(),
            totalScore: 88
        });
        expect(result.success).toBe(false);
    });
});

describe('RecommendationFeedResponseSchema', () => {
    it('should parse a valid personalized feed response', () => {
        const result = RecommendationFeedResponseSchema.safeParse({
            items: [
                {
                    accommodation: createCandidateFixture(),
                    score: createScoreBreakdownFixture(),
                    totalScore: 88
                }
            ],
            isColdStart: false,
            generatedAt: new Date()
        });
        expect(result.success).toBe(true);
    });

    it('should parse a valid cold-start (fallback) feed response with an empty item list', () => {
        const result = RecommendationFeedResponseSchema.safeParse({
            items: [],
            isColdStart: true,
            generatedAt: new Date()
        });
        expect(result.success).toBe(true);
    });

    it('should coerce an ISO date string for generatedAt', () => {
        const result = RecommendationFeedResponseSchema.safeParse({
            items: [],
            isColdStart: true,
            generatedAt: '2026-06-30T00:00:00.000Z'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.generatedAt).toBeInstanceOf(Date);
        }
    });

    it('should reject a feed response missing isColdStart', () => {
        const result = RecommendationFeedResponseSchema.safeParse({
            items: [],
            generatedAt: new Date()
        });
        expect(result.success).toBe(false);
    });
});
