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
 * Represents a review for a destination with all content, status, voting,
 * trip context, and recommendation fields stored in the database.
 */
export const DestinationReviewSchema = z.object({
    // Base fields
    id: DestinationReviewIdSchema,
    ...BaseAuditFields,
    ...BaseAdminFields,

    // Relation fields
    userId: UserIdSchema,
    destinationId: DestinationIdSchema,

    // Review content fields
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
    rating: DestinationRatingSchema,

    /**
     * Denormalized average of all rating sub-fields for this review.
     * Computed by the database from the individual rating dimensions.
     * PostgreSQL returns numeric as string, so z.coerce.number() handles the conversion.
     * Range: 0.00 – 5.00 (numeric 3,2 in the DB).
     */
    averageRating: z.coerce.number().min(0).max(5).default(0),

    // Visit context fields
    /**
     * Date when the reviewer visited the destination.
     * Used for filtering reviews by visit period.
     */
    visitDate: z.coerce.date().optional(),

    /**
     * Type of trip (e.g. "FAMILY", "ROMANTIC", "BUSINESS", "SOLO", "GROUP").
     * Free-form string to accommodate different categorization strategies.
     */
    tripType: z.string().optional(),

    /**
     * Season during which the visit took place (e.g. "SUMMER", "WINTER", "SPRING", "AUTUMN").
     */
    travelSeason: z.string().optional(),

    /**
     * Whether the trip was for business purposes.
     * Defaults to false (leisure travel).
     */
    isBusinessTravel: z.boolean().default(false),

    /**
     * Two-character ISO 639-1 language code of the review content (e.g. "es", "en").
     */
    language: z.string().length(2).optional(),

    // Status fields
    /**
     * Whether the review has been verified by a moderator or automated system.
     * Verified reviews carry more weight in rating calculations.
     */
    isVerified: z.boolean().default(false),

    /**
     * Whether the review is publicly visible.
     * Unpublished reviews are hidden from public listing endpoints.
     */
    isPublished: z.boolean().default(false),

    // Recommendation fields
    /**
     * Whether the reviewer recommends the destination to others.
     */
    isRecommended: z.boolean().default(true),

    /**
     * Whether the reviewer would visit the destination again.
     */
    wouldVisitAgain: z.boolean().default(true),

    // Voting/helpfulness fields
    /**
     * Number of users who marked this review as helpful.
     * Non-negative integer.
     */
    helpfulVotes: z.number().int().min(0).default(0),

    /**
     * Total number of votes (helpful + unhelpful) received on this review.
     * Non-negative integer. Always >= helpfulVotes.
     */
    totalVotes: z.number().int().min(0).default(0),

    // Owner response field
    /**
     * Whether the destination owner has responded to this review.
     * Computed or stored flag used to filter reviews with owner engagement.
     */
    hasOwnerResponse: z.boolean().default(false)
});

/**
 * Type export for the destination review schema.
 * Single source of truth for the DestinationReview type across the monorepo.
 */
export type DestinationReview = z.infer<typeof DestinationReviewSchema>;
