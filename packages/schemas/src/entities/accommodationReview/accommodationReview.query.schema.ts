import { z } from 'zod';
import { AccommodationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { AccommodationIdParamsSchema } from '../../common/params.schema.js';
import { ListWithUserSchema, PaginationSchema } from '../../common/search.schemas.js';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * Schema for listing accommodation reviews by accommodation ID
 * Combines accommodation ID parameter with pagination
 */
export const AccommodationReviewListByAccommodationParamsSchema =
    AccommodationIdParamsSchema.merge(PaginationSchema);

/**
 * Schema for listing accommodation reviews with user information
 * Reuses the generic ListWithUserSchema
 */
export const AccommodationReviewListWithUserParamsSchema = ListWithUserSchema;

/**
 * Schema for searching accommodation reviews
 * Extends base search with accommodation-specific filters
 */
export const AccommodationReviewSearchParamsSchema = z
    .object({
        accommodationId: AccommodationIdSchema.optional(),
        userId: UserIdSchema.optional(),
        rating: z.number().min(1).max(5).optional(),
        hasContent: z.boolean().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional()
    })
    .merge(PaginationSchema);

/**
 * Schema for accommodation review with user information
 * Extends the base review schema with user fields
 */
export const AccommodationReviewWithUserSchema = AccommodationReviewSchema.extend({
    user: z
        .object({
            id: UserIdSchema,
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            email: z.string().email()
        })
        .optional()
});

/**
 * Output schema for accommodation review list with user information
 */
export const AccommodationReviewListWithUserOutputSchema = z.object({
    items: z.array(AccommodationReviewWithUserSchema),
    total: z.number().int().min(0)
});

/**
 * Output schema for accommodation review list by accommodation
 */
export const AccommodationReviewListByAccommodationOutputSchema = z.object({
    items: z.array(AccommodationReviewSchema),
    total: z.number().int().min(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationReviewListByAccommodationParams = z.infer<
    typeof AccommodationReviewListByAccommodationParamsSchema
>;
export type AccommodationReviewListWithUserParams = z.infer<
    typeof AccommodationReviewListWithUserParamsSchema
>;
export type AccommodationReviewSearchParams = z.infer<typeof AccommodationReviewSearchParamsSchema>;
export type AccommodationReviewWithUser = z.infer<typeof AccommodationReviewWithUserSchema>;
export type AccommodationReviewListWithUserOutput = z.infer<
    typeof AccommodationReviewListWithUserOutputSchema
>;
export type AccommodationReviewListByAccommodationOutput = z.infer<
    typeof AccommodationReviewListByAccommodationOutputSchema
>;
