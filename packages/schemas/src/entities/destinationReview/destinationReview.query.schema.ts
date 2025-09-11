import { z } from 'zod';
import { DestinationIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * Destination Review Query Schemas
 *
 * This file contains all schemas related to query operations for destination reviews:
 * - Search and filtering
 * - List operations
 * - Aggregation and stats
 * - Relations with other entities
 */

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for destination review search filters
 * Extends base search with destination review specific filters
 */
export const DestinationReviewSearchFiltersSchema = z.object({
    destinationId: DestinationIdSchema.optional(),
    userId: UserIdSchema.optional(),
    rating: z
        .object({
            min: z.number().min(0).max(5).optional(),
            max: z.number().min(0).max(5).optional()
        })
        .optional(),
    hasTitle: z.boolean().optional(),
    hasContent: z.boolean().optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional()
});

/**
 * Schema for destination review search input
 * Combines base search with destination review specific filters
 */
export const DestinationReviewSearchInputSchema = BaseSearchSchema.extend({
    filters: DestinationReviewSearchFiltersSchema.optional()
});

/**
 * Schema for destination review search output
 * Returns paginated list of destination reviews
 */
export const DestinationReviewSearchOutputSchema = z.object({
    items: z.array(DestinationReviewSchema),
    pagination: z.object({
        page: z.number().int().positive(),
        pageSize: z.number().int().positive(),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0)
    }),
    filters: DestinationReviewSearchFiltersSchema.optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for destination review list input
 * Simple pagination without complex filtering
 */
export const DestinationReviewListInputSchema = PaginationSchema.extend({
    destinationId: DestinationIdSchema.optional(),
    userId: UserIdSchema.optional()
});

/**
 * Schema for destination review list output
 * Returns paginated list of destination reviews
 */
export const DestinationReviewListOutputSchema = z.object({
    items: z.array(DestinationReviewSchema),
    total: z.number().int().min(0),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional()
});

/**
 * Schema for destination review list with user information
 * Extends the review with user details
 */
export const DestinationReviewWithUserSchema = DestinationReviewSchema.extend({
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
 * Schema for destination review list with user output
 * Returns paginated list of destination reviews with user information
 */
export const DestinationReviewListWithUserOutputSchema = z.object({
    items: z.array(DestinationReviewWithUserSchema),
    total: z.number().int().min(0),
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive().optional()
});

// ============================================================================
// COUNT SCHEMAS
// ============================================================================

/**
 * Schema for destination review count input
 * Uses same filters as search but only returns count
 */
export const DestinationReviewCountInputSchema = z.object({
    filters: DestinationReviewSearchFiltersSchema.optional()
});

/**
 * Schema for destination review count output
 * Returns the total count of matching reviews
 */
export const DestinationReviewCountOutputSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// STATS SCHEMAS
// ============================================================================

/**
 * Schema for destination review stats by destination
 * Aggregated statistics for a specific destination
 */
export const DestinationReviewStatsSchema = z.object({
    destinationId: DestinationIdSchema,
    totalReviews: z.number().int().min(0),
    averageRating: z.number().min(0).max(5),
    ratingDistribution: z.object({
        1: z.number().int().min(0),
        2: z.number().int().min(0),
        3: z.number().int().min(0),
        4: z.number().int().min(0),
        5: z.number().int().min(0)
    }),
    reviewsWithTitle: z.number().int().min(0),
    reviewsWithContent: z.number().int().min(0)
});

/**
 * Schema for destination review stats input
 * Requires destination ID and optional date range
 */
export const DestinationReviewStatsInputSchema = z.object({
    destinationId: DestinationIdSchema,
    dateFrom: z.date().optional(),
    dateTo: z.date().optional()
});

/**
 * Schema for destination review stats output
 * Returns aggregated statistics
 */
export const DestinationReviewStatsOutputSchema = DestinationReviewStatsSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationReviewSearchFilters = z.infer<typeof DestinationReviewSearchFiltersSchema>;
export type DestinationReviewSearchInput = z.infer<typeof DestinationReviewSearchInputSchema>;
export type DestinationReviewSearchOutput = z.infer<typeof DestinationReviewSearchOutputSchema>;
export type DestinationReviewListInput = z.infer<typeof DestinationReviewListInputSchema>;
export type DestinationReviewListOutput = z.infer<typeof DestinationReviewListOutputSchema>;
export type DestinationReviewWithUser = z.infer<typeof DestinationReviewWithUserSchema>;
export type DestinationReviewListWithUserOutput = z.infer<
    typeof DestinationReviewListWithUserOutputSchema
>;
export type DestinationReviewCountInput = z.infer<typeof DestinationReviewCountInputSchema>;
export type DestinationReviewCountOutput = z.infer<typeof DestinationReviewCountOutputSchema>;
export type DestinationReviewStats = z.infer<typeof DestinationReviewStatsSchema>;
export type DestinationReviewStatsInput = z.infer<typeof DestinationReviewStatsInputSchema>;
export type DestinationReviewStatsOutput = z.infer<typeof DestinationReviewStatsOutputSchema>;
