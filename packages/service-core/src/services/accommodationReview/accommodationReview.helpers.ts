/**
 * AccommodationReview helpers (extend as needed)
 */

/**
 * Example: Calculate average rating from a list of reviews
 */
import type { AccommodationRatingInput, AccommodationReview } from '@repo/schemas';

/**
 * Calculates stats (reviewsCount, averageRating, rating) from a list of accommodation reviews.
 * @param reviews - Array of AccommodationReview
 * @returns Object with reviewsCount, averageRating, and rating (per-field averages)
 */
export function calculateStatsFromReviews(reviews: readonly AccommodationReview[]): {
    reviewsCount: number;
    averageRating: number;
    rating: AccommodationRatingInput;
} {
    const reviewsCount = reviews.length;
    const ratingFields: (keyof AccommodationRatingInput)[] = [
        'cleanliness',
        'hospitality',
        'services',
        'accuracy',
        'communication',
        'location'
    ];
    const ratingSums: Record<keyof AccommodationRatingInput, number> = {
        cleanliness: 0,
        hospitality: 0,
        services: 0,
        accuracy: 0,
        communication: 0,
        location: 0
    };
    let totalRatings = 0;
    let totalSum = 0;
    for (const review of reviews) {
        for (const field of ratingFields) {
            const value = review.rating[field] ?? 0;
            ratingSums[field] += value;
            totalSum += value;
            totalRatings++;
        }
    }
    const rating: AccommodationRatingInput = {
        cleanliness: reviewsCount ? ratingSums.cleanliness / reviewsCount : 0,
        hospitality: reviewsCount ? ratingSums.hospitality / reviewsCount : 0,
        services: reviewsCount ? ratingSums.services / reviewsCount : 0,
        accuracy: reviewsCount ? ratingSums.accuracy / reviewsCount : 0,
        communication: reviewsCount ? ratingSums.communication / reviewsCount : 0,
        location: reviewsCount ? ratingSums.location / reviewsCount : 0
    };
    const averageRating = totalRatings ? totalSum / totalRatings : 0;
    return { reviewsCount, averageRating, rating };
}
