import type { AccommodationReviewType } from '@repo/types';
import { describe, expect, it } from 'vitest';
import { calculateAverageRating } from '../../../src/services/accommodationReview/accommodationReview.helpers';

/**
 * Test suite for calculateAverageRating helper in AccommodationReviewService.
 * Ensures robust, predictable, and homogeneous calculation of average cleanliness rating.
 */
describe('calculateAverageRating (AccommodationReviewService)', () => {
    it('returns 0 if reviews array is empty', () => {
        const reviews: AccommodationReviewType[] = [];
        expect(calculateAverageRating(reviews)).toBe(0);
    });

    it('returns the cleanliness rating for a single review', () => {
        const reviews: AccommodationReviewType[] = [
            { rating: { cleanliness: 4 }, id: '1' } as AccommodationReviewType
        ];
        expect(calculateAverageRating(reviews)).toBe(4);
    });

    it('calculates the average cleanliness rating for multiple reviews', () => {
        const reviews: AccommodationReviewType[] = [
            { rating: { cleanliness: 4 }, id: '1' } as AccommodationReviewType,
            { rating: { cleanliness: 2 }, id: '2' } as AccommodationReviewType,
            { rating: { cleanliness: 5 }, id: '3' } as AccommodationReviewType
        ];
        expect(calculateAverageRating(reviews)).toBeCloseTo(3.6667, 4);
    });

    it('treats missing cleanliness ratings as 0', () => {
        const reviews: AccommodationReviewType[] = [
            { rating: { cleanliness: 4 }, id: '1' } as AccommodationReviewType,
            { rating: {}, id: '2' } as AccommodationReviewType,
            { rating: { cleanliness: 2 }, id: '3' } as AccommodationReviewType
        ];
        expect(calculateAverageRating(reviews)).toBeCloseTo(2, 4);
    });
});
