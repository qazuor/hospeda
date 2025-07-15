/**
 * AccommodationReview helpers (extend as needed)
 */

/**
 * Example: Calculate average rating from a list of reviews
 */
import type { AccommodationReviewType } from '@repo/types';

export function calculateAverageRating(reviews: readonly AccommodationReviewType[]): number {
    if (!reviews.length) return 0;
    const sum = reviews.reduce((acc, review) => acc + (review.rating?.cleanliness ?? 0), 0);
    return sum / reviews.length;
}
