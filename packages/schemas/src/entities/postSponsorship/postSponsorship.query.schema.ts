import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { PriceCurrencyEnumSchema } from '../../enums/index.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { PostSponsorshipSchema } from './postSponsorship.schema.js';

/**
 * Post Sponsorship Query Schemas
 *
 * Standardized query schemas for post sponsorship operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for post sponsorships
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Post sponsorship-specific filters that extend the base search functionality
 */
export const PostSponsorshipFiltersSchema = z.object({
    // Basic filters
    sponsorId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),

    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Date filters
    paidAfter: z.date().optional(),
    paidBefore: z.date().optional(),
    fromDateAfter: z.date().optional(),
    fromDateBefore: z.date().optional(),
    toDateAfter: z.date().optional(),
    toDateBefore: z.date().optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Boolean filters
    isPaid: z.boolean().optional(),
    hasMessage: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isExpired: z.boolean().optional()
});

export type PostSponsorshipFilters = z.infer<typeof PostSponsorshipFiltersSchema>;

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete post sponsorship search schema combining base search with sponsorship-specific filters
 * FLAT PATTERN: All filters are at the top level for HTTP compatibility
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const PostSponsorshipSearchSchema = BaseSearchSchema.extend({
    // Basic filters (flattened from PostSponsorshipFiltersSchema)
    sponsorId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),

    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Date filters
    paidAfter: z.date().optional(),
    paidBefore: z.date().optional(),
    fromDateAfter: z.date().optional(),
    fromDateBefore: z.date().optional(),
    toDateAfter: z.date().optional(),
    toDateBefore: z.date().optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Boolean filters
    isPaid: z.boolean().optional(),
    hasMessage: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isExpired: z.boolean().optional()
});

export type PostSponsorshipSearch = z.infer<typeof PostSponsorshipSearchSchema>;

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Post sponsorship list item schema - contains essential fields for list display
 */
export const PostSponsorshipListItemSchema = PostSponsorshipSchema.pick({
    id: true,
    sponsorId: true,
    postId: true,
    message: true,
    description: true,
    paid: true,
    paidAt: true,
    fromDate: true,
    toDate: true,
    createdAt: true,
    updatedAt: true
});

export type PostSponsorshipListItem = z.infer<typeof PostSponsorshipListItemSchema>;

/**
 * Post sponsorship search result item - extends list item with search relevance score
 */
export const PostSponsorshipSearchResultItemSchema = PostSponsorshipListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

export type PostSponsorshipSearchResultItem = z.infer<typeof PostSponsorshipSearchResultItemSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Post sponsorship list response using standardized pagination format
 */
export const PostSponsorshipListResponseSchema = PaginationResultSchema(
    PostSponsorshipListItemSchema
);

export type PostSponsorshipListResponse = z.infer<typeof PostSponsorshipListResponseSchema>;

/**
 * Post sponsorship search response using standardized pagination format with search results
 */
export const PostSponsorshipSearchResponseSchema = PaginationResultSchema(
    PostSponsorshipSearchResultItemSchema
);

export type PostSponsorshipSearchResponse = z.infer<typeof PostSponsorshipSearchResponseSchema>;

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting sponsorships by sponsor
 */
export const SponsorshipsBySponsorSchema = z.object({
    sponsorId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

export type SponsorshipsBySponsor = z.infer<typeof SponsorshipsBySponsorSchema>;

/**
 * Schema for getting sponsorships by post
 */
export const SponsorshipsByPostSchema = z.object({
    postId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10)
});

export type SponsorshipsByPost = z.infer<typeof SponsorshipsByPostSchema>;

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Post sponsorship statistics schema
 */
export const PostSponsorshipStatsSchema = z.object({
    total: z.number().int().min(0).default(0),
    paid: z.number().int().min(0).default(0),
    unpaid: z.number().int().min(0).default(0),
    active: z.number().int().min(0).default(0),
    expired: z.number().int().min(0).default(0),
    totalRevenue: z.number().min(0).default(0),
    averagePrice: z.number().min(0).default(0)
});

export type PostSponsorshipStats = z.infer<typeof PostSponsorshipStatsSchema>;

// ============================================================================
// WRAPPER SCHEMAS
// ============================================================================

/**
 * Wrapper schema for post sponsorship list
 * Provides consistent format for list responses
 */
export const PostSponsorshipListWrapperSchema = z.object({
    sponsorships: z.array(PostSponsorshipSchema)
});

export type PostSponsorshipListWrapper = z.infer<typeof PostSponsorshipListWrapperSchema>;

/**
 * Wrapper schema for post sponsorship stats
 * Provides consistent format for stats responses
 */
export const PostSponsorshipStatsWrapperSchema = z.object({
    stats: PostSponsorshipStatsSchema
});

export type PostSponsorshipStatsWrapper = z.infer<typeof PostSponsorshipStatsWrapperSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for post sponsorship search schema
 */
export const POST_SPONSORSHIP_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'PostSponsorshipSearch',
    title: 'Post Sponsorship Search',
    description:
        'Search and filter parameters for post sponsorships with comprehensive filtering options',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'paidAt',
        sortOrder: 'desc',
        q: 'premium',
        sponsorId: '123e4567-e89b-12d3-a456-426614174000',
        postId: '456e7890-e89b-12d3-a456-426614174001',
        minPrice: 100,
        maxPrice: 1000,
        currency: 'USD',
        isPaid: true,
        isActive: true
    },
    fields: {
        page: {
            description: 'Page number for pagination',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        sortBy: {
            description: 'Field to sort by',
            example: 'paidAt'
        },
        sortOrder: {
            description: 'Sort direction',
            example: 'desc',
            enum: ['asc', 'desc']
        },
        q: {
            description: 'General search query for sponsorship message or description',
            example: 'premium'
        },
        sponsorId: {
            description: 'Filter by sponsor UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        postId: {
            description: 'Filter by post UUID',
            example: '456e7890-e89b-12d3-a456-426614174001',
            format: 'uuid'
        },
        minPrice: {
            description: 'Minimum sponsorship price',
            example: 100,
            minimum: 0
        },
        maxPrice: {
            description: 'Maximum sponsorship price',
            example: 1000,
            minimum: 0
        },
        currency: {
            description: 'Currency for price filters',
            example: 'USD',
            enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
        },
        isPaid: {
            description: 'Filter by payment status',
            example: true
        },
        isActive: {
            description: 'Filter active sponsorships only',
            example: true
        }
    },
    tags: ['Post Sponsorships', 'Search'],
    externalDocs: {
        description: 'Post Sponsorship Search API Documentation',
        url: 'https://docs.hospeda.com/api/post-sponsorships/search'
    }
};

/**
 * Post sponsorship search schema with OpenAPI metadata applied
 */
export const PostSponsorshipSearchSchemaWithMetadata = applyOpenApiMetadata(
    PostSponsorshipSearchSchema,
    POST_SPONSORSHIP_SEARCH_METADATA
);
