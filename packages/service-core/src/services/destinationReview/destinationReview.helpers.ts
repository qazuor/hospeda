// TODO: Add destinationReview-specific helpers if needed.

import type { DestinationRatingType, DestinationReviewType } from '@repo/types';

/**
 * Calculates stats (reviewsCount, averageRating, rating) from a list of destination reviews.
 * @param reviews - Array of DestinationReviewType
 * @returns Object with reviewsCount, averageRating, and rating (per-field averages)
 */
export function calculateStatsFromReviews(reviews: readonly DestinationReviewType[]): {
    reviewsCount: number;
    averageRating: number;
    rating: DestinationRatingType;
} {
    const reviewsCount = reviews.length;
    const ratingFields: (keyof DestinationRatingType)[] = [
        'landscape',
        'attractions',
        'accessibility',
        'safety',
        'cleanliness',
        'hospitality',
        'culturalOffer',
        'gastronomy',
        'affordability',
        'nightlife',
        'infrastructure',
        'environmentalCare',
        'wifiAvailability',
        'shopping',
        'beaches',
        'greenSpaces',
        'localEvents',
        'weatherSatisfaction'
    ];
    const ratingSums: Record<keyof DestinationRatingType, number> = {
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
    const rating: DestinationRatingType = {
        landscape: reviewsCount ? ratingSums.landscape / reviewsCount : 0,
        attractions: reviewsCount ? ratingSums.attractions / reviewsCount : 0,
        accessibility: reviewsCount ? ratingSums.accessibility / reviewsCount : 0,
        safety: reviewsCount ? ratingSums.safety / reviewsCount : 0,
        cleanliness: reviewsCount ? ratingSums.cleanliness / reviewsCount : 0,
        hospitality: reviewsCount ? ratingSums.hospitality / reviewsCount : 0,
        culturalOffer: reviewsCount ? ratingSums.culturalOffer / reviewsCount : 0,
        gastronomy: reviewsCount ? ratingSums.gastronomy / reviewsCount : 0,
        affordability: reviewsCount ? ratingSums.affordability / reviewsCount : 0,
        nightlife: reviewsCount ? ratingSums.nightlife / reviewsCount : 0,
        infrastructure: reviewsCount ? ratingSums.infrastructure / reviewsCount : 0,
        environmentalCare: reviewsCount ? ratingSums.environmentalCare / reviewsCount : 0,
        wifiAvailability: reviewsCount ? ratingSums.wifiAvailability / reviewsCount : 0,
        shopping: reviewsCount ? ratingSums.shopping / reviewsCount : 0,
        beaches: reviewsCount ? ratingSums.beaches / reviewsCount : 0,
        greenSpaces: reviewsCount ? ratingSums.greenSpaces / reviewsCount : 0,
        localEvents: reviewsCount ? ratingSums.localEvents / reviewsCount : 0,
        weatherSatisfaction: reviewsCount ? ratingSums.weatherSatisfaction / reviewsCount : 0
    };
    const averageRating = totalRatings ? totalSum / totalRatings : 0;
    return { reviewsCount, averageRating, rating };
}
