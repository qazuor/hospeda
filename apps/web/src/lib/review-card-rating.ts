/**
 * @file review-card-rating.ts
 * @description Which star value a public review card shows (HOS-2082).
 *
 * A review carries two scalars: `overallRating`, the general star rating the
 * reviewer explicitly chose, and `averageRating`, the mean of the dimensions
 * they voted (persisted for aggregates). The card shows what the reviewer
 * chose, so a 4-star review with only "service 5" voted reads 4, not 5.
 */

/** The rating fields of a public review item. */
export interface ReviewCardRatingInput {
    readonly overallRating?: number | null;
    readonly averageRating?: number | null;
}

/**
 * Resolve the rating a review card displays.
 *
 * `overallRating` is NOT NULL with default 0 in the DB, so legacy rows that
 * never carried one read back as 0. A non-positive or absent overall therefore
 * falls back to `averageRating` (the previous behaviour).
 *
 * @param review - The review's rating fields.
 * @returns The value to show, or `null` when the review has no usable rating.
 */
export function resolveReviewCardRating(review: ReviewCardRatingInput): number | null {
    const { overallRating, averageRating } = review;
    if (overallRating != null && overallRating > 0) return overallRating;
    return averageRating ?? null;
}
