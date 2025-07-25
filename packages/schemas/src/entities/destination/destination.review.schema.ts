import { z } from 'zod';
import {
    DestinationIdSchema,
    DestinationReviewIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { WithAdminInfoSchema, WithAuditSchema, WithIdSchema } from '../../common/index.js';
import { DestinationRatingSchema } from './destination.rating.schema.js';

/**
 * Destination Review schema definition using Zod for validation.
 * Represents a review for a destination.
 */
export const DestinationReviewSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        id: DestinationReviewIdSchema,
        userId: UserIdSchema,
        destinationId: DestinationIdSchema,
        title: z
            .string()
            .min(1, { message: 'error:destination.review.title.min_length' })
            .max(50, { message: 'error:destination.review.title.max_length' })
            .optional(),
        content: z
            .string()
            .min(10, { message: 'error:destination.review.content.min_length' })
            .max(500, { message: 'error:destination.review.content.max_length' })
            .optional(),
        rating: DestinationRatingSchema
    });

/**
 * Input schema for creating a Destination Review (sin campos de auditoría ni id)
 */
export const DestinationReviewCreateInputSchema = z.object({
    userId: UserIdSchema,
    destinationId: DestinationIdSchema,
    title: z
        .string()
        .min(1, { message: 'error:destination.review.title.min_length' })
        .max(50, { message: 'error:destination.review.title.max_length' })
        .optional(),
    content: z
        .string()
        .min(10, { message: 'error:destination.review.content.min_length' })
        .max(500, { message: 'error:destination.review.content.max_length' })
        .optional(),
    rating: DestinationRatingSchema
});
