/**
 * Tests for attributeRecommendationReason (BETA-152).
 *
 * The reason is attributed purely from the score breakdown's `destination`
 * (0–40) and `type` (0–20) components:
 *  - DESTINATION when destination >= 12 (region tier or deeper).
 *  - TYPE when type > 0.
 *  - the stronger normalized share wins when both qualify (ties → DESTINATION).
 *  - OTHER otherwise (incl. cold-start, where both are 0).
 */
import type { RecommendationScoreBreakdown } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    attributeRecommendationReason,
    DESTINATION_REASON_MIN_POINTS,
    TYPE_REASON_MIN_POINTS
} from '../../../src/services/recommendation/recommendation.reason';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Builds a score breakdown, defaulting every component to 0 (neutral). */
const createScore = (
    overrides: Partial<RecommendationScoreBreakdown> = {}
): RecommendationScoreBreakdown => ({
    destination: 0,
    type: 0,
    price: 0,
    amenities: 0,
    quality: 0,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attributeRecommendationReason', () => {
    describe('DESTINATION', () => {
        it('attributes DESTINATION for a city-level destination match and no type match', () => {
            // destination 40 (city) >= 12 threshold, type 0 → DESTINATION
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 40, type: 0 })
            });
            expect(reason).toBe('DESTINATION');
        });

        it('attributes DESTINATION at exactly the region threshold (12)', () => {
            // destination 12 == DESTINATION_REASON_MIN_POINTS (inclusive) → qualifies
            const reason = attributeRecommendationReason({
                score: createScore({ destination: DESTINATION_REASON_MIN_POINTS })
            });
            expect(reason).toBe('DESTINATION');
        });

        it('wins the tie over TYPE when normalized shares are equal', () => {
            // destination 20/40 = 0.5, type 10/20 = 0.5 → tie → DESTINATION
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 20, type: 10 })
            });
            expect(reason).toBe('DESTINATION');
        });

        it('wins over TYPE when its normalized share is strictly higher', () => {
            // destination 32/40 = 0.8 > type 10/20 = 0.5 → DESTINATION
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 32, type: 10 })
            });
            expect(reason).toBe('DESTINATION');
        });
    });

    describe('TYPE', () => {
        it('attributes TYPE for a type match when destination is below the region threshold', () => {
            // destination 4 (country-only) < 12, type 20 > 0 → TYPE
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 4, type: 20 })
            });
            expect(reason).toBe('TYPE');
        });

        it('attributes TYPE for a type match when there is no destination signal', () => {
            const reason = attributeRecommendationReason({
                score: createScore({ type: 15 })
            });
            expect(reason).toBe('TYPE');
        });

        it('wins over DESTINATION when its normalized share is strictly higher', () => {
            // type 20/20 = 1.0 > destination 12/40 = 0.3 → TYPE
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 12, type: 20 })
            });
            expect(reason).toBe('TYPE');
        });
    });

    describe('OTHER', () => {
        it('attributes OTHER for a country-only destination match with no type match', () => {
            // destination 4 (country) < 12 threshold, type 0 → OTHER
            const reason = attributeRecommendationReason({
                score: createScore({ destination: 4, type: TYPE_REASON_MIN_POINTS })
            });
            expect(reason).toBe('OTHER');
        });

        it('attributes OTHER when only price/amenities/quality drove the score', () => {
            // destination 0, type 0, but price/amenities/quality present → OTHER
            const reason = attributeRecommendationReason({
                score: createScore({ price: 20, amenities: 15, quality: 5 })
            });
            expect(reason).toBe('OTHER');
        });

        it('attributes OTHER for a cold-start item (empty profile ⇒ all-zero score)', () => {
            const reason = attributeRecommendationReason({ score: createScore() });
            expect(reason).toBe('OTHER');
        });
    });
});
