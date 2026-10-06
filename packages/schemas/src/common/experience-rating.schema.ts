import { z } from 'zod';

// ============================================================================
// ExperienceRatingSchema — granular rating breakdown for experience listings.
// ============================================================================

/**
 * Granular rating breakdown for an experience listing.
 * Each dimension is scored from 0 to 5 (inclusive), where 0 is the worst and 5 is the best.
 *
 * Dimensions:
 * - `food`     — Quality of food / core product offering.
 * - `service`  — Staff attentiveness and quality of service.
 * - `ambiance` — Atmosphere, decor, and overall environment.
 * - `value`    — Price-to-quality ratio.
 *
 * @example
 * ```ts
 * const rating: ExperienceRating = {
 *   food: 4.5,
 *   service: 5,
 *   ambiance: 4,
 *   value: 3.5,
 * };
 * ```
 */
export const ExperienceRatingSchema = z.object({
    /**
     * Food/product quality score.
     * @minimum 0
     * @maximum 5
     */
    food: z
        .number({
            message: 'zodError.common.listingRating.food.required'
        })
        .min(0, { message: 'zodError.common.listingRating.food.min' })
        .max(5, { message: 'zodError.common.listingRating.food.max' }),

    /**
     * Service quality score.
     * @minimum 0
     * @maximum 5
     */
    service: z
        .number({
            message: 'zodError.common.listingRating.service.required'
        })
        .min(0, { message: 'zodError.common.listingRating.service.min' })
        .max(5, { message: 'zodError.common.listingRating.service.max' }),

    /**
     * Ambiance / atmosphere score.
     * @minimum 0
     * @maximum 5
     */
    ambiance: z
        .number({
            message: 'zodError.common.listingRating.ambiance.required'
        })
        .min(0, { message: 'zodError.common.listingRating.ambiance.min' })
        .max(5, { message: 'zodError.common.listingRating.ambiance.max' }),

    /**
     * Value for money score.
     * @minimum 0
     * @maximum 5
     */
    value: z
        .number({
            message: 'zodError.common.listingRating.value.required'
        })
        .min(0, { message: 'zodError.common.listingRating.value.min' })
        .max(5, { message: 'zodError.common.listingRating.value.max' })
});

export type ExperienceRating = z.infer<typeof ExperienceRatingSchema>;

/**
 * Spread const for embedding the experience rating block into entity schemas.
 *
 * @example
 * ```ts
 * const GastronomySchema = z.object({
 *   id: z.string().uuid(),
 *   ...ExperienceRatingFields,
 * });
 * ```
 */
export const ExperienceRatingFields = {
    /** Granular rating breakdown for this experience listing. */
    rating: ExperienceRatingSchema.optional()
} as const;
