import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';
import { AccommodationRatingSchema } from './accommodation.rating.schema.js';

/**
 * Accommodation Review schema definition using Zod for validation.
 * Represents a review for an accommodation.
 */
export const AccommodationReviewSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        accommodationId: z
            .string({
                message: 'zodError.accommodation.review.accommodationId.required'
            })
            .uuid({ message: 'zodError.accommodation.review.accommodationId.invalidUuid' }),
        userId: z
            .string({
                message: 'zodError.accommodation.review.userId.required'
            })
            .uuid({ message: 'zodError.accommodation.review.userId.invalidUuid' }),
        title: z
            .string({
                message: 'zodError.accommodation.review.title.required'
            })
            .min(3, { message: 'zodError.accommodation.review.title.min' })
            .max(100, { message: 'zodError.accommodation.review.title.max' })
            .optional(),
        content: z
            .string({
                message: 'zodError.accommodation.review.content.required'
            })
            .min(10, { message: 'zodError.accommodation.review.content.min' })
            .max(2000, { message: 'zodError.accommodation.review.content.max' })
            .optional(),
        rating: AccommodationRatingSchema
    });
