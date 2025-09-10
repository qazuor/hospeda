import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import {
    AccommodationIdSchema,
    AccommodationReviewIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { AccommodationRatingSchema } from '../accommodation/accommodation.rating.schema.js';

/**
 * Accommodation Review schema definition using Zod for validation.
 * Represents a review for an accommodation.
 */
export const AccommodationReviewSchema = z.object({
    // Base fields
    id: AccommodationReviewIdSchema,
    ...BaseAuditFields,
    ...BaseAdminFields,
    userId: UserIdSchema,
    accommodationId: AccommodationIdSchema,
    title: z
        .string()
        .min(1, { message: 'error:accommodation.review.title.min_length' })
        .max(200, { message: 'error:accommodation.review.title.max_length' })
        .optional(),
    content: z
        .string()
        .min(10, { message: 'error:accommodation.review.content.min_length' })
        .max(2000, { message: 'error:accommodation.review.content.max_length' })
        .optional(),
    rating: AccommodationRatingSchema
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationReview = z.infer<typeof AccommodationReviewSchema>;
