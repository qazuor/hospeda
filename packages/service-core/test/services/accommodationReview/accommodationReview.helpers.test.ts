import type { AccommodationRatingInput, AccommodationReview } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { calculateStatsFromReviews } from '../../../src/services/accommodationReview/accommodationReview.helpers';

/**
 * Test suite for calculateStatsFromReviews helper in AccommodationReviewService.
 * Ensures robust, predictable, and homogeneous calculation of average cleanliness rating.
 */
describe('calculateStatsFromReviews', () => {
    it('should return initial stats for empty reviews array', () => {
        const emptyRating: AccommodationRatingInput = {
            cleanliness: 0,
            hospitality: 0,
            services: 0,
            accuracy: 0,
            communication: 0,
            location: 0
        };

        // Test with empty array
        const stats = calculateStatsFromReviews([]);
        expect(stats.reviewsCount).toBe(0);
        expect(stats.averageRating).toBe(0);
        expect(stats.rating).toEqual(emptyRating);
    });

    it('should return zero stats when no reviews', () => {
        const reviews: AccommodationReview[] = [];
        const stats = calculateStatsFromReviews(reviews);

        expect(stats.reviewsCount).toBe(0);
        expect(stats.averageRating).toBe(0);
        expect(stats.rating).toEqual({
            cleanliness: 0,
            hospitality: 0,
            services: 0,
            accuracy: 0,
            communication: 0,
            location: 0
        });
    });

    it('should calculate correct stats for single review', () => {
        const fullRating: AccommodationRatingInput = {
            cleanliness: 5,
            hospitality: 5,
            services: 5,
            accuracy: 5,
            communication: 5,
            location: 5
        };

        const reviews: AccommodationReview[] = [
            { rating: fullRating, id: '1' } as AccommodationReview
        ];

        const stats = calculateStatsFromReviews(reviews);
        expect(stats.reviewsCount).toBe(1);
        expect(stats.averageRating).toBe(5);
        expect(stats.rating).toEqual(fullRating);
    });

    it('should calculate correct stats for multiple reviews', () => {
        const reviews: AccommodationReview[] = [
            {
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 5,
                    communication: 4,
                    location: 5
                },
                id: '1'
            } as AccommodationReview,
            {
                rating: {
                    cleanliness: 3,
                    hospitality: 3,
                    services: 4,
                    accuracy: 4,
                    communication: 3,
                    location: 4
                },
                id: '2'
            } as AccommodationReview,
            {
                rating: {
                    cleanliness: 4,
                    hospitality: 5,
                    services: 3,
                    accuracy: 3,
                    communication: 5,
                    location: 3
                },
                id: '3'
            } as AccommodationReview
        ];

        const stats = calculateStatsFromReviews(reviews);
        expect(stats.reviewsCount).toBe(3);
        expect(stats.averageRating).toBeCloseTo(4.0, 1);
        expect(stats.rating.cleanliness).toBeCloseTo(4, 1);
        expect(stats.rating.hospitality).toBeCloseTo(4, 1);
        expect(stats.rating.services).toBeCloseTo(4, 1);
        expect(stats.rating.accuracy).toBeCloseTo(4, 1);
        expect(stats.rating.communication).toBeCloseTo(4, 1);
        expect(stats.rating.location).toBeCloseTo(4, 1);
    });

    it('should handle incomplete rating data', () => {
        const reviews: AccommodationReview[] = [
            {
                rating: {
                    cleanliness: 5,
                    hospitality: 4,
                    services: 5,
                    accuracy: 5,
                    communication: 4,
                    location: 5
                },
                id: '1'
            } as AccommodationReview,
            { rating: { cleanliness: 2 }, id: '2' } as AccommodationReview,
            {
                rating: {
                    cleanliness: 4,
                    location: 3
                },
                id: '3'
            } as AccommodationReview
        ];

        const stats = calculateStatsFromReviews(reviews);
        expect(stats.reviewsCount).toBe(3);
        // Should still calculate correctly with incomplete data
        expect(stats.averageRating).toBeGreaterThan(0);
        expect(stats.rating.cleanliness).toBeCloseTo(3.67, 2);
    });
});
