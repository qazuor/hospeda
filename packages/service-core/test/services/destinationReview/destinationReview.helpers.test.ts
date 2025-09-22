import type { DestinationRatingInput, DestinationReview } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { calculateStatsFromReviews } from '../../../src/services/destinationReview/destinationReview.helpers';

const fullRating: DestinationRatingInput = {
    landscape: 5,
    attractions: 4,
    accessibility: 3,
    safety: 4,
    cleanliness: 5,
    hospitality: 4,
    culturalOffer: 3,
    gastronomy: 4,
    affordability: 3,
    nightlife: 2,
    infrastructure: 4,
    environmentalCare: 3,
    wifiAvailability: 4,
    shopping: 3,
    beaches: 5,
    greenSpaces: 4,
    localEvents: 3,
    weatherSatisfaction: 5
};

describe('calculateStatsFromReviews (DestinationReviewService)', () => {
    it('returns zeros if reviews array is empty', () => {
        const reviews: DestinationReview[] = [];
        const result = calculateStatsFromReviews(reviews);
        expect(result).toEqual({
            reviewsCount: 0,
            averageRating: 0,
            rating: {
                landscape: 0,
                attractions: 0,
                accessibility: 0,
                safety: 0,
                cleanliness: 0,
                hospitality: 0,
                culturalOffer: 0,
                gastronomy: 0,
                affordability: 0,
                nightlife: 0,
                infrastructure: 0,
                environmentalCare: 0,
                wifiAvailability: 0,
                shopping: 0,
                beaches: 0,
                greenSpaces: 0,
                localEvents: 0,
                weatherSatisfaction: 0
            }
        });
    });

    it('returns the rating for a single review', () => {
        const reviews: DestinationReview[] = [{ rating: fullRating, id: '1' } as DestinationReview];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(1);
        expect(result.rating).toEqual(fullRating);
        const expectedAvg = Object.values(fullRating).reduce((a, b) => a + b, 0) / 18;
        expect(result.averageRating).toBeCloseTo(expectedAvg, 4);
    });

    it('calcula promedios correctos para múltiples reviews', () => {
        const reviews: DestinationReview[] = [
            { rating: fullRating, id: '1' } as DestinationReview,
            {
                rating: { ...fullRating, landscape: 3, attractions: 2 },
                id: '2'
            } as DestinationReview,
            {
                rating: { ...fullRating, safety: 2, gastronomy: 1 },
                id: '3'
            } as DestinationReview
        ];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(3);
        // Ejemplo: landscape promedio
        expect(result.rating.landscape).toBeCloseTo((5 + 3 + 5) / 3, 4);
        expect(result.rating.attractions).toBeCloseTo((4 + 2 + 4) / 3, 4);
        expect(result.rating.safety).toBeCloseTo((4 + 4 + 2) / 3, 4);
        expect(result.rating.gastronomy).toBeCloseTo((4 + 4 + 1) / 3, 4);
        // averageRating: suma de todos los valores / total de ratings
        const totalSum =
            Object.values(fullRating).reduce((a, b) => a + b, 0) +
            Object.values({ ...fullRating, landscape: 3, attractions: 2 }).reduce(
                (a, b) => a + b,
                0
            ) +
            Object.values({ ...fullRating, safety: 2, gastronomy: 1 }).reduce((a, b) => a + b, 0);
        const totalRatings = 3 * 18;
        expect(result.averageRating).toBeCloseTo(totalSum / totalRatings, 4);
    });

    it('trata ratings faltantes como 0', () => {
        const reviews: DestinationReview[] = [
            {
                rating: { landscape: 5, attractions: 4 } as DestinationRatingInput,
                id: '1'
            } as DestinationReview,
            {
                rating: { safety: 3, cleanliness: 4 } as DestinationRatingInput,
                id: '2'
            } as DestinationReview,
            {
                rating: { hospitality: 2, gastronomy: 1 } as DestinationRatingInput,
                id: '3'
            } as DestinationReview
        ];
        const result = calculateStatsFromReviews(reviews);
        expect(result.reviewsCount).toBe(3);
        expect(result.rating.landscape).toBeCloseTo((5 + 0 + 0) / 3, 4);
        expect(result.rating.safety).toBeCloseTo((0 + 3 + 0) / 3, 4);
        expect(result.rating.hospitality).toBeCloseTo((0 + 0 + 2) / 3, 4);
        expect(result.rating.gastronomy).toBeCloseTo((0 + 0 + 1) / 3, 4);
    });
});
