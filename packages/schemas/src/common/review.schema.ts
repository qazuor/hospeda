import { z } from 'zod';

/**
 * Base review relation fields (for entities that have separate review tables)
 * NOTE: Actual reviews are stored in separate entities (AccommodationReviewSchema, DestinationReviewSchema)
 */
export const BaseReviewFields = {
    reviewsCount: z
        .number({
            message: 'zodError.common.reviewsCount.required'
        })
        .int()
        .min(0)
        .default(0),
    averageRating: z
        .number({
            message: 'zodError.common.averageRating.required'
        })
        .min(0)
        .max(5)
        .default(0)
} as const;

/**
 * Review Schema - Complete review aggregation information
 * Can be used as a standalone schema when needed
 */
export const ReviewSchema = z.object({
    ...BaseReviewFields
});
export type Review = z.infer<typeof ReviewSchema>;
