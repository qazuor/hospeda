import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { DestinationReviewSchema } from './destinationReview.schema.js';

/**
 * DestinationReview Query Schemas
 *
 * Standardized query schemas for destination review operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for destination reviews
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * DestinationReview-specific filters that extend the base search functionality
 */
export const DestinationReviewFiltersSchema = z.object({
    // Entity relation filters
    destinationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    rating: z.number().min(1).max(5).optional(),

    // Content filters
    hasTitle: z.boolean().optional(),
    hasContent: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    minContentLength: z.number().int().min(0).optional(),
    maxContentLength: z.number().int().min(0).optional(),

    // Date filters
    reviewedAfter: z.date().optional(),
    reviewedBefore: z.date().optional(),
    visitedAfter: z.date().optional(),
    visitedBefore: z.date().optional(),

    // Status filters
    isVerified: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isFlagged: z.boolean().optional(),

    // Response filters
    hasOwnerResponse: z.boolean().optional(),
    responseAfter: z.date().optional(),
    responseBefore: z.date().optional(),

    // Helpful/voting filters
    minHelpfulVotes: z.number().int().min(0).optional(),
    minTotalVotes: z.number().int().min(0).optional(),

    // Language filter
    language: z.string().length(2).optional(),

    // Trip type filters
    tripType: z.string().optional(),
    travelSeason: z.string().optional(),
    isBusinessTravel: z.boolean().optional(),
    isReturningVisitor: z.boolean().optional(),

    // Recommendation filters
    isRecommended: z.boolean().optional(),
    wouldVisitAgain: z.boolean().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete destination review search schema combining base search with review-specific filters
 * MIGRATED TO FLAT PATTERN: All filters are at the top level for HTTP compatibility
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const DestinationReviewSearchSchema = BaseSearchSchema.extend({
    // Entity relation filters (flattened from DestinationReviewFiltersSchema)
    destinationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    rating: z.number().min(1).max(5).optional(),

    // Content filters
    hasTitle: z.boolean().optional(),
    hasContent: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    minContentLength: z.number().int().min(0).optional(),
    maxContentLength: z.number().int().min(0).optional(),

    // Date filters
    reviewedAfter: z.date().optional(),
    reviewedBefore: z.date().optional(),
    visitedAfter: z.date().optional(),
    visitedBefore: z.date().optional(),

    // Status filters
    isVerified: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    isFlagged: z.boolean().optional(),

    // Response filters
    hasOwnerResponse: z.boolean().optional(),
    responseAfter: z.date().optional(),
    responseBefore: z.date().optional(),

    // Helpful/voting filters
    minHelpfulVotes: z.number().int().min(0).optional(),
    minTotalVotes: z.number().int().min(0).optional(),

    // Language filter
    language: z.string().length(2).optional(),

    // Trip type filters
    tripType: z.string().optional(),
    travelSeason: z.string().optional(),
    isBusinessTravel: z.boolean().optional(),
    isReturningVisitor: z.boolean().optional(),

    // Recommendation filters
    isRecommended: z.boolean().optional(),
    wouldVisitAgain: z.boolean().optional()
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing reviews by destination
 */
export const DestinationReviewsByDestinationSchema = z.object({
    destinationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'rating', 'helpfulVotes', 'visitDate']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    minRating: z.number().min(1).max(5).optional(),
    hasContent: z.boolean().optional(),
    isVerified: z.boolean().optional()
});

/**
 * Schema for listing reviews by user
 */
export const DestinationReviewsByUserSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'rating', 'visitDate']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    destinationId: z.string().uuid().optional()
});

/**
 * Schema for getting review statistics by destination
 */
export const DestinationReviewStatsSchema = z.object({
    destinationId: z.string().uuid(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * DestinationReview list item schema - contains essential fields for list display
 */
export const DestinationReviewListItemSchema = DestinationReviewSchema.pick({
    id: true,
    destinationId: true,
    userId: true,
    rating: true,
    title: true,
    content: true,
    visitDate: true,
    tripType: true,
    isVerified: true,
    isPublished: true,
    isRecommended: true,
    helpfulVotes: true,
    totalVotes: true,
    hasOwnerResponse: true,
    createdAt: true,
    updatedAt: true
});

/**
 * DestinationReview search result item - extends list item with search relevance score
 */
export const DestinationReviewSearchResultItemSchema = DestinationReviewListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * DestinationReview with user information
 */
export const DestinationReviewWithUserSchema = DestinationReviewListItemSchema.extend({
    user: z
        .object({
            id: z.string().uuid(),
            firstName: z.string().optional(),
            lastName: z.string().optional(),
            displayName: z.string().optional(),
            avatar: z.string().url().optional()
        })
        .optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * DestinationReview list response using standardized pagination format
 */
export const DestinationReviewListResponseSchema = PaginationResultSchema(
    DestinationReviewListItemSchema
);

/**
 * DestinationReview search response using standardized pagination format with search results
 */
export const DestinationReviewSearchResponseSchema = PaginationResultSchema(
    DestinationReviewSearchResultItemSchema
);

/**
 * DestinationReview list with user information response
 */
export const DestinationReviewWithUserResponseSchema = PaginationResultSchema(
    DestinationReviewWithUserSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * DestinationReview summary schema for quick display
 */
export const DestinationReviewSummarySchema = DestinationReviewSchema.pick({
    id: true,
    destinationId: true,
    userId: true,
    rating: true,
    title: true,
    content: true,
    visitDate: true,
    isVerified: true,
    isPublished: true,
    isRecommended: true,
    createdAt: true
});

/**
 * DestinationReview statistics schema
 */
export const DestinationReviewStatsResponseSchema = z.object({
    destinationId: z.string().uuid(),
    totalReviews: z.number().int().min(0).default(0),
    averageRating: z.number().min(0).max(5).default(0),

    // Rating distribution
    ratingDistribution: z.object({
        1: z.number().int().min(0).default(0),
        2: z.number().int().min(0).default(0),
        3: z.number().int().min(0).default(0),
        4: z.number().int().min(0).default(0),
        5: z.number().int().min(0).default(0)
    }),

    // Content statistics
    reviewsWithTitle: z.number().int().min(0).default(0),
    reviewsWithContent: z.number().int().min(0).default(0),
    reviewsWithImages: z.number().int().min(0).default(0),
    verifiedReviews: z.number().int().min(0).default(0),
    reviewsWithOwnerResponse: z.number().int().min(0).default(0),

    // Recommendation statistics
    recommendedCount: z.number().int().min(0).default(0),
    wouldVisitAgainCount: z.number().int().min(0).default(0),

    // Recent activity
    reviewsThisMonth: z.number().int().min(0).default(0),
    reviewsThisYear: z.number().int().min(0).default(0),

    // Trip type distribution
    tripTypeDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Seasonal distribution
    seasonalDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Most helpful reviews
    mostHelpfulReviews: z
        .array(
            z.object({
                id: z.string().uuid(),
                rating: z.number().min(1).max(5),
                title: z.string(),
                helpfulVotes: z.number().int().min(0),
                totalVotes: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationReviewFilters = z.infer<typeof DestinationReviewFiltersSchema>;
export type DestinationReviewSearchInput = z.infer<typeof DestinationReviewSearchSchema>;
export type DestinationReviewsByDestinationInput = z.infer<
    typeof DestinationReviewsByDestinationSchema
>;
export type DestinationReviewsByUserInput = z.infer<typeof DestinationReviewsByUserSchema>;
export type DestinationReviewStatsInput = z.infer<typeof DestinationReviewStatsSchema>;
export type DestinationReviewListItem = z.infer<typeof DestinationReviewListItemSchema>;
export type DestinationReviewSearchResultItem = z.infer<
    typeof DestinationReviewSearchResultItemSchema
>;
export type DestinationReviewWithUser = z.infer<typeof DestinationReviewWithUserSchema>;
export type DestinationReviewListResponse = z.infer<typeof DestinationReviewListResponseSchema>;
export type DestinationReviewSearchResponse = z.infer<typeof DestinationReviewSearchResponseSchema>;
export type DestinationReviewWithUserResponse = z.infer<
    typeof DestinationReviewWithUserResponseSchema
>;
export type DestinationReviewSummary = z.infer<typeof DestinationReviewSummarySchema>;
export type DestinationReviewStatsResponse = z.infer<typeof DestinationReviewStatsResponseSchema>;

// Compatibility aliases for existing code
export type DestinationReviewListInput = DestinationReviewSearchInput;
export type DestinationReviewListOutput = DestinationReviewListResponse;
export type DestinationReviewSearchOutput = DestinationReviewSearchResponse;
export type DestinationReviewListByDestinationParams = DestinationReviewsByDestinationInput;
export type DestinationReviewListWithUserParams = DestinationReviewSearchInput;
export type DestinationReviewSearchParams = DestinationReviewSearchInput;
export type DestinationReviewListWithUserOutput = DestinationReviewWithUserResponse;
export type DestinationReviewListByDestinationOutput = DestinationReviewListResponse;
export type DestinationReviewCountInput = DestinationReviewSearchInput;
export type DestinationReviewStatsOutput = DestinationReviewStatsResponse;

// Additional compatibility schema
const DestinationReviewCountSchema = z.object({ count: z.number().int().min(0) });
export type DestinationReviewCountOutput = z.infer<typeof DestinationReviewCountSchema>;

// Legacy compatibility exports
export const DestinationReviewListInputSchema = DestinationReviewSearchSchema;
export const DestinationReviewListOutputSchema = DestinationReviewListResponseSchema;
export const DestinationReviewSearchInputSchema = DestinationReviewSearchSchema;
export const DestinationReviewSearchOutputSchema = DestinationReviewSearchResponseSchema;
export const DestinationReviewListByDestinationParamsSchema = DestinationReviewsByDestinationSchema;
export const DestinationReviewListWithUserParamsSchema = DestinationReviewSearchSchema;
export const DestinationReviewSearchParamsSchema = DestinationReviewSearchSchema;
export const DestinationReviewListWithUserOutputSchema = DestinationReviewWithUserResponseSchema;
export const DestinationReviewListByDestinationOutputSchema = DestinationReviewListResponseSchema;
export const DestinationReviewCountInputSchema = DestinationReviewSearchSchema;
export const DestinationReviewCountOutputSchema = z.object({ count: z.number().int().min(0) });
export const DestinationReviewStatsInputSchema = DestinationReviewStatsSchema;
export const DestinationReviewStatsOutputSchema = DestinationReviewStatsResponseSchema;

// Additional schemas preserved for backward compatibility
export const DestinationReviewSearchFiltersSchema = DestinationReviewFiltersSchema;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS & OPENAPI METADATA
// ============================================================================

export const HttpDestinationReviewSearchSchema = HttpPaginationSchema.merge(
    HttpSortingSchema
).extend({
    q: z.string().optional(),
    destinationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    minRating: HttpQueryFields.minRating(),
    maxRating: HttpQueryFields.maxRating(),
    isVerified: HttpQueryFields.isVerified(),
    hasImages: HttpQueryFields.hasImages(),
    languageCode: z.string().length(2).optional(),
    visitType: z
        .enum(['BUSINESS', 'LEISURE', 'FAMILY', 'ROMANTIC', 'ADVENTURE', 'CULTURAL'])
        .optional()
});

export const DESTINATION_REVIEW_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'DestinationReviewSearch',
    description: 'Schema for searching destination reviews',
    title: 'Destination Review Search Parameters',
    example: { page: 1, pageSize: 20, q: 'amazing experience', minRating: 4, visitType: 'LEISURE' },
    fields: {
        q: { description: 'Search query in review content', example: 'amazing experience' },
        destinationId: { description: 'Filter by destination', example: 'uuid-here' },
        minRating: { description: 'Minimum rating (1-5)', example: 4 },
        visitType: { description: 'Type of visit', example: 'LEISURE' }
    },
    tags: ['destination-reviews', 'search']
};

export const DestinationReviewSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpDestinationReviewSearchSchema,
    DESTINATION_REVIEW_SEARCH_METADATA
);
