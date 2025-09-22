import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    DestinationIdSchema,
    DestinationReviewIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { DestinationRatingSchema } from '../destination/subtypes/destination.rating.schema.js';

/**
 * Destination Review schema definition using Zod for validation.
 * Represents a review for a destination.
 */
export const DestinationReviewSchema = z.object({
    // Base fields
    id: DestinationReviewIdSchema,
    ...BaseAuditFields,
    ...BaseAdminFields,

    // Review fields
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
 * Type export for the destination review schema
 */
export type DestinationReview = z.infer<typeof DestinationReviewSchema>;
