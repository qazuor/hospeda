import { z } from 'zod';

// ============================================================================
// CommerceRatingSchema — granular rating breakdown for commerce listings.
// ============================================================================

/**
 * Granular rating breakdown for a commerce listing (gastronomy, experience, etc.).
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
 * const rating: CommerceRating = {
 *   food: 4.5,
 *   service: 5,
 *   ambiance: 4,
 *   value: 3.5,
 * };
 * ```
 */
export const CommerceRatingSchema = z.object({
    /**
     * Food/product quality score.
     * @minimum 0
     * @maximum 5
     */
    food: z
        .number({
            message: 'zodError.common.commerceRating.food.required'
        })
        .min(0, { message: 'zodError.common.commerceRating.food.min' })
        .max(5, { message: 'zodError.common.commerceRating.food.max' }),

    /**
     * Service quality score.
     * @minimum 0
     * @maximum 5
     */
    service: z
        .number({
            message: 'zodError.common.commerceRating.service.required'
        })
        .min(0, { message: 'zodError.common.commerceRating.service.min' })
        .max(5, { message: 'zodError.common.commerceRating.service.max' }),

    /**
     * Ambiance / atmosphere score.
     * @minimum 0
     * @maximum 5
     */
    ambiance: z
        .number({
            message: 'zodError.common.commerceRating.ambiance.required'
        })
        .min(0, { message: 'zodError.common.commerceRating.ambiance.min' })
        .max(5, { message: 'zodError.common.commerceRating.ambiance.max' }),

    /**
     * Value for money score.
     * @minimum 0
     * @maximum 5
     */
    value: z
        .number({
            message: 'zodError.common.commerceRating.value.required'
        })
        .min(0, { message: 'zodError.common.commerceRating.value.min' })
        .max(5, { message: 'zodError.common.commerceRating.value.max' })
});

export type CommerceRating = z.infer<typeof CommerceRatingSchema>;

/**
 * Spread const for embedding the commerce rating block into entity schemas.
 *
 * @example
 * ```ts
 * const GastronomySchema = z.object({
 *   id: z.string().uuid(),
 *   ...CommerceRatingFields,
 * });
 * ```
 */
export const CommerceRatingFields = {
    /** Granular rating breakdown for this commerce listing. */
    rating: CommerceRatingSchema.optional()
} as const;
