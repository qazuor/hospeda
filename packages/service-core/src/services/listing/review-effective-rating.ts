/**
 * review-effective-rating.ts
 *
 * Shared per-review scalar rating computation for the listing verticals whose
 * reviews carry a granular dimension breakdown (venue and experience, see
 * `REVIEW_RULES`). One implementation so both services persist the same
 * `averageRating` for the same submission (HOS-2083).
 *
 * @module review-effective-rating
 */

import { REVIEW_RULES } from '@repo/schemas';

/** Verticals that declare review dimensions in `REVIEW_RULES`. */
export type ReviewRatedVertical = keyof typeof REVIEW_RULES;

/** Input of {@link computeEffectiveReviewRating}. */
export interface ComputeEffectiveReviewRatingInput {
    /** Vertical whose declared dimensions are averaged. */
    readonly vertical: ReviewRatedVertical;
    /** The validated create input of a review. */
    readonly input: {
        readonly overallRating: number;
        readonly rating?: Readonly<Record<string, number | undefined>> | undefined;
    };
}

/**
 * Computes the effective scalar rating (0-5, 2-decimal) for a review submission.
 *
 * - With a granular `rating` breakdown: mean of the dimensions the reviewer
 *   actually voted (a missing key means "did not vote").
 * - Without a breakdown, or when no dimension was voted: the required scalar
 *   `overallRating`.
 *
 * @param params - The vertical and the validated create input.
 * @returns The effective scalar rating to persist as `averageRating`.
 */
export function computeEffectiveReviewRating({
    vertical,
    input
}: ComputeEffectiveReviewRatingInput): number {
    const breakdown = input.rating;
    if (breakdown) {
        const dimensions = REVIEW_RULES[vertical].dimensions;
        const voted = dimensions.flatMap(({ id }) => {
            const value = breakdown[id];
            return value === undefined ? [] : [value];
        });
        if (voted.length === 0) return input.overallRating;
        const mean = voted.reduce((sum, value) => sum + value, 0) / voted.length;
        return Math.round(mean * 100) / 100;
    }
    return input.overallRating;
}
