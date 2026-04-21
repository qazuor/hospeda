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

/**
 * Computes the average of a per-review JSONB rating object whose runtime
 * shape is not enforced by Zod (it comes from the DB column). The previous
 * inline implementation cast the value to `Record<string, number>`, which
 * was dishonest about the actual lack of guarantees.
 *
 * Accepts `unknown` and defensively filters numeric values; returns 0 for
 * empty/non-object inputs (matching the legacy behavior). Caller decides
 * whether to round.
 *
 * Extracted in T-032 / GAP-039.
 */
export function computeAccommodationReviewAverage(rating: unknown): number {
    if (!rating || typeof rating !== 'object') {
        return 0;
    }
    const values = Object.values(rating as Record<string, unknown>).filter(
        (v): v is number => typeof v === 'number'
    );
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
