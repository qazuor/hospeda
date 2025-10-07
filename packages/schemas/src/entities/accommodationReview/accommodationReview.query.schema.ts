import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { AccommodationReviewSchema } from './accommodationReview.schema.js';

/**
 * AccommodationReview Query Schemas
 *
 * Standardized query schemas for accommodation review operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for accommodation reviews
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * AccommodationReview-specific filters that extend the base search functionality
 */
export const AccommodationReviewFiltersSchema = z.object({
    // Entity relation filters
    accommodationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    rating: z.number().min(1).max(5).optional(),

    // Content filters
    hasContent: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    minContentLength: z.number().int().min(0).optional(),
    maxContentLength: z.number().int().min(0).optional(),

    // Date filters
    reviewedAfter: z.date().optional(),
    reviewedBefore: z.date().optional(),
    stayDateAfter: z.date().optional(),
    stayDateBefore: z.date().optional(),

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

    // Guest type filters
    guestType: z.string().optional(),
    isBusinessTravel: z.boolean().optional(),
    isReturningGuest: z.boolean().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete accommodation review search schema combining base search with review-specific filters
 * MIGRATED TO FLAT PATTERN: All filters are at the top level for HTTP compatibility
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const AccommodationReviewSearchSchema = BaseSearchSchema.extend({
    // Entity relation filters (flattened from AccommodationReviewFiltersSchema)
    accommodationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),

    // Rating filters
    minRating: z.number().min(1).max(5).optional(),
    maxRating: z.number().min(1).max(5).optional(),
    rating: z.number().min(1).max(5).optional(),

    // Content filters
    hasContent: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    minContentLength: z.number().int().min(0).optional(),
    maxContentLength: z.number().int().min(0).optional(),

    // Date filters
    reviewedAfter: z.date().optional(),
    reviewedBefore: z.date().optional(),
    stayDateAfter: z.date().optional(),
    stayDateBefore: z.date().optional(),

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

    // Guest type filters
    guestType: z.string().optional(),
    isBusinessTravel: z.boolean().optional(),
    isReturningGuest: z.boolean().optional()
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing reviews by accommodation
 */
export const AccommodationReviewsByAccommodationSchema = z.object({
    accommodationId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'rating', 'helpfulVotes', 'stayDate']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    minRating: z.number().min(1).max(5).optional(),
    hasContent: z.boolean().optional(),
    isVerified: z.boolean().optional()
});

/**
 * Schema for listing reviews by user
 */
export const AccommodationReviewsByUserSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'rating', 'stayDate']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    accommodationId: z.string().uuid().optional()
});

/**
 * Schema for getting review statistics by accommodation
 */
export const AccommodationReviewStatsSchema = z.object({
    accommodationId: z.string().uuid()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * AccommodationReview list item schema - contains essential fields for list display
 */
export const AccommodationReviewListItemSchema = AccommodationReviewSchema.pick({
    id: true,
    accommodationId: true,
    userId: true,
    rating: true,
    title: true,
    content: true,
    createdAt: true,
    updatedAt: true
});

/**
 * AccommodationReview search result item - extends list item with search relevance score
 */
export const AccommodationReviewSearchResultItemSchema = AccommodationReviewListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

/**
 * AccommodationReview with user information
 */
export const AccommodationReviewWithUserSchema = AccommodationReviewListItemSchema.extend({
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
 * AccommodationReview list response using standardized pagination format
 */
export const AccommodationReviewListResponseSchema = PaginationResultSchema(
    AccommodationReviewListItemSchema
);

/**
 * AccommodationReview search response using standardized pagination format with search results
 */
export const AccommodationReviewSearchResponseSchema = PaginationResultSchema(
    AccommodationReviewSearchResultItemSchema
);

/**
 * AccommodationReview list with user information response
 */
export const AccommodationReviewWithUserResponseSchema = PaginationResultSchema(
    AccommodationReviewWithUserSchema
);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * AccommodationReview summary schema for quick display
 */
export const AccommodationReviewSummarySchema = AccommodationReviewSchema.pick({
    id: true,
    accommodationId: true,
    userId: true,
    rating: true,
    title: true,
    content: true,
    stayDate: true,
    isVerified: true,
    isPublished: true,
    createdAt: true
});

/**
 * AccommodationReview statistics schema
 */
export const AccommodationReviewStatsResponseSchema = z.object({
    accommodationId: z.string().uuid(),
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
    reviewsWithContent: z.number().int().min(0).default(0),
    reviewsWithImages: z.number().int().min(0).default(0),
    verifiedReviews: z.number().int().min(0).default(0),
    reviewsWithOwnerResponse: z.number().int().min(0).default(0),

    // Recent activity
    reviewsThisMonth: z.number().int().min(0).default(0),
    reviewsThisYear: z.number().int().min(0).default(0),

    // Guest type distribution
    guestTypeDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

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

export type AccommodationReviewFilters = z.infer<typeof AccommodationReviewFiltersSchema>;
export type AccommodationReviewSearchInput = z.infer<typeof AccommodationReviewSearchSchema>;
export type AccommodationReviewsByAccommodationInput = z.infer<
    typeof AccommodationReviewsByAccommodationSchema
>;
export type AccommodationReviewsByUserInput = z.infer<typeof AccommodationReviewsByUserSchema>;
export type AccommodationReviewStatsInput = z.infer<typeof AccommodationReviewStatsSchema>;
export type AccommodationReviewListItem = z.infer<typeof AccommodationReviewListItemSchema>;
export type AccommodationReviewSearchResultItem = z.infer<
    typeof AccommodationReviewSearchResultItemSchema
>;
export type AccommodationReviewWithUser = z.infer<typeof AccommodationReviewWithUserSchema>;
export type AccommodationReviewListResponse = z.infer<typeof AccommodationReviewListResponseSchema>;
export type AccommodationReviewSearchResponse = z.infer<
    typeof AccommodationReviewSearchResponseSchema
>;
export type AccommodationReviewWithUserResponse = z.infer<
    typeof AccommodationReviewWithUserResponseSchema
>;
export type AccommodationReviewSummary = z.infer<typeof AccommodationReviewSummarySchema>;
export type AccommodationReviewStatsResponse = z.infer<
    typeof AccommodationReviewStatsResponseSchema
>;

// Compatibility aliases for existing code
export type AccommodationReviewListInput = AccommodationReviewSearchInput;
export type AccommodationReviewListOutput = AccommodationReviewListResponse;
export type AccommodationReviewSearchOutput = AccommodationReviewSearchResponse;
export type AccommodationReviewListByAccommodationParams = AccommodationReviewsByAccommodationInput;
export type AccommodationReviewListWithUserParams = AccommodationReviewSearchInput;
export type AccommodationReviewSearchParams = AccommodationReviewSearchInput;
export type AccommodationReviewListWithUserOutput = AccommodationReviewWithUserResponse;
export type AccommodationReviewListByAccommodationOutput = AccommodationReviewListResponse;

// Legacy compatibility exports
export const AccommodationReviewListInputSchema = AccommodationReviewSearchSchema;
export const AccommodationReviewListOutputSchema = AccommodationReviewListResponseSchema;
export const AccommodationReviewSearchInputSchema = AccommodationReviewSearchSchema;
export const AccommodationReviewSearchOutputSchema = AccommodationReviewSearchResponseSchema;
export const AccommodationReviewListByAccommodationParamsSchema =
    AccommodationReviewsByAccommodationSchema;
export const AccommodationReviewListWithUserParamsSchema = AccommodationReviewSearchSchema;
export const AccommodationReviewSearchParamsSchema = AccommodationReviewSearchSchema;
export const AccommodationReviewListWithUserOutputSchema =
    AccommodationReviewWithUserResponseSchema;
export const AccommodationReviewListByAccommodationOutputSchema =
    AccommodationReviewListResponseSchema;

// ============================================================================
// WRAPPER SCHEMAS (for service consistency)
// ============================================================================

/**
 * Wrapper schema for accommodation review list responses
 * Follows the established pattern: { accommodationReviews: AccommodationReview[] }
 */
export const AccommodationReviewListWrapperSchema = z.object({
    accommodationReviews: z.array(AccommodationReviewListItemSchema)
});

/**
 * Wrapper schema for accommodation review statistics responses
 * Follows the established pattern: { stats: AccommodationReviewStats }
 */
export const AccommodationReviewStatsWrapperSchema = z.object({
    stats: AccommodationReviewStatsResponseSchema
});

/**
 * Wrapper schema for accommodation review with user list responses
 */
export const AccommodationReviewWithUserListWrapperSchema = z.object({
    accommodationReviews: z.array(AccommodationReviewWithUserSchema)
});

// Type exports for wrapper schemas
export type AccommodationReviewListWrapper = z.infer<typeof AccommodationReviewListWrapperSchema>;
export type AccommodationReviewStatsWrapper = z.infer<typeof AccommodationReviewStatsWrapperSchema>;
export type AccommodationReviewWithUserListWrapper = z.infer<
    typeof AccommodationReviewWithUserListWrapperSchema
>;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS & OPENAPI METADATA
// ============================================================================

export const HttpAccommodationReviewSearchSchema = HttpPaginationSchema.merge(
    HttpSortingSchema
).extend({
    q: z.string().optional(),
    accommodationId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    minRating: HttpQueryFields.minRating(),
    maxRating: HttpQueryFields.maxRating(),
    isVerified: HttpQueryFields.isVerified(),
    hasImages: HttpQueryFields.hasImages(),
    languageCode: z.string().length(2).optional()
});

export const ACCOMMODATION_REVIEW_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'AccommodationReviewSearch',
    description: 'Schema for searching accommodation reviews',
    title: 'Accommodation Review Search Parameters',
    example: { page: 1, pageSize: 20, q: 'great stay', minRating: 4, hasImages: true },
    fields: {
        q: { description: 'Search query in review content', example: 'great stay' },
        accommodationId: { description: 'Filter by accommodation', example: 'uuid-here' },
        minRating: { description: 'Minimum rating (1-5)', example: 4 },
        hasImages: { description: 'Filter reviews with images', example: true }
    },
    tags: ['accommodation-reviews', 'search']
};

export const AccommodationReviewSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpAccommodationReviewSearchSchema,
    ACCOMMODATION_REVIEW_SEARCH_METADATA
);
