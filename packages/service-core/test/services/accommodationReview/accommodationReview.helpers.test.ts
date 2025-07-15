import type { AccommodationRatingType, AccommodationReviewType } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { calculateStatsFromReviews } from '../../../src/services/accommodationReview/accommodationReview.helpers';

const fullRating: AccommodationRatingType = {
    cleanliness: 4,
    hospitality: 5,
    services: 3,
    accuracy: 4,
    communication: 5,
    location: 4
};

/**
 * Test suite for calculateStatsFromReviews helper in AccommodationReviewService.
 * Ensures robust, predictable, and homogeneous calculation of average cleanliness rating.
 */
describe('calculateStatsFromReviews (AccommodationReviewService)', () => {
    it('returns zeros if reviews array is empty', () => {
        const reviews: AccommodationReviewType[] = [];
        const result = calculateStatsFromReviews(reviews);
        expect(result).toEqual({
            reviewsCount: 0,
            averageRating: 0,
            rating: {
                cleanliness: 0,
                hospitality: 0,
                services: 0,
                accuracy: 0,
                communication: 0,
                location: 0
            }
        });
    });

    it('returns the rating for a single review', () => {
        const reviews: AccommodationReviewType[] = [
            { rating: fullRating, id: '1' } as AccommodationReviewType
        ];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(1);
        expect(result.rating).toEqual(fullRating);
        // averageRating: suma de todos los campos / cantidad de campos
        const expectedAvg = (4 + 5 + 3 + 4 + 5 + 4) / 6;
        expect(result.averageRating).toBeCloseTo(expectedAvg, 4);
    });

    it('calcula promedios correctos para múltiples reviews', () => {
        const reviews: AccommodationReviewType[] = [
            {
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 3,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                },
                id: '1'
            } as AccommodationReviewType,
            {
                rating: {
                    cleanliness: 2,
                    hospitality: 3,
                    services: 4,
                    accuracy: 3,
                    communication: 4,
                    location: 3
                },
                id: '2'
            } as AccommodationReviewType,
            {
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 5,
                    communication: 5,
                    location: 5
                },
                id: '3'
            } as AccommodationReviewType
        ];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(3);
        expect(result.rating.cleanliness).toBeCloseTo((4 + 2 + 5) / 3, 4);
        expect(result.rating.hospitality).toBeCloseTo((5 + 3 + 4) / 3, 4);
        expect(result.rating.services).toBeCloseTo((3 + 4 + 5) / 3, 4);
        expect(result.rating.accuracy).toBeCloseTo((4 + 3 + 5) / 3, 4);
        expect(result.rating.communication).toBeCloseTo((5 + 4 + 5) / 3, 4);
        expect(result.rating.location).toBeCloseTo((4 + 3 + 5) / 3, 4);
        // averageRating: suma de todos los valores / total de ratings
        const totalSum = 4 + 5 + 3 + 4 + 5 + 4 + (2 + 3 + 4 + 3 + 4 + 3) + (5 + 4 + 5 + 5 + 5 + 5);
        const totalRatings = 3 * 6;
        expect(result.averageRating).toBeCloseTo(totalSum / totalRatings, 4);
    });

    it('trata ratings faltantes como 0', () => {
        const reviews: AccommodationReviewType[] = [
            {
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 3,
                    accuracy: 4,
                    communication: 5,
                    location: 4
                },
                id: '1'
            } as AccommodationReviewType,
            { rating: { cleanliness: 2 }, id: '2' } as AccommodationReviewType,
            {
                rating: { cleanliness: 5, hospitality: 4, services: 5 },
                id: '3'
            } as AccommodationReviewType
        ];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(3);
        // Los campos faltantes se consideran 0 en el promedio
        expect(result.rating.hospitality).toBeCloseTo((5 + 0 + 4) / 3, 4);
        expect(result.rating.services).toBeCloseTo((3 + 0 + 5) / 3, 4);
        expect(result.rating.accuracy).toBeCloseTo((4 + 0 + 0) / 3, 4);
        expect(result.rating.communication).toBeCloseTo((5 + 0 + 0) / 3, 4);
        expect(result.rating.location).toBeCloseTo((4 + 0 + 0) / 3, 4);
    });
});
