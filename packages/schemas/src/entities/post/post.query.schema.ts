import { z } from 'zod';
import { HttpPaginationSchema, HttpSortingSchema } from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { LifecycleStatusEnumSchema, PostCategoryEnumSchema } from '../../enums/index.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { PostSchema } from './post.schema.js';

/**
 * Post Query Schemas
 *
 * Standardized query schemas for post operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for posts
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Post-specific filters that extend the base search functionality
 */
export const PostFiltersSchema = z.object({
    // Basic filters
    status: LifecycleStatusEnumSchema.optional(),
    category: PostCategoryEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isPublished: z.boolean().optional(),

    // Author filters
    authorId: z.string().uuid().optional(),

    // Date range filters
    publishedAfter: z.date().optional(),
    publishedBefore: z.date().optional(),
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),

    // Content filters
    hasMedia: z.boolean().optional(),
    hasFeaturedImage: z.boolean().optional(),

    // Reading time filters
    minReadingTime: z.number().int().min(1).optional(),
    maxReadingTime: z.number().int().min(1).optional(),

    // Tags filter
    tags: z.array(z.string().uuid()).optional(),

    // Related entities
    destinationId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),

    // Sponsorship filters
    isSponsored: z.boolean().optional(),
    sponsorId: z.string().uuid().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete post search schema combining base search with post-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: Post-specific filtering options
 */
export const PostSearchSchema = BaseSearchSchema.extend({
    filters: PostFiltersSchema.optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Post list item schema - contains essential fields for list display
 */
export const PostListItemSchema = PostSchema.pick({
    id: true,
    slug: true,
    title: true,
    summary: true,
    category: true,
    lifecycleState: true,
    isFeatured: true,
    publishedAt: true,
    readingTimeMinutes: true,
    media: true,
    authorId: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Post search result item - extends list item with search relevance score
 */
export const PostSearchResultItemSchema = PostListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Post list response using standardized pagination format
 */
export const PostListResponseSchema = PaginationResultSchema(PostListItemSchema);

/**
 * Post search response using standardized pagination format with search results
 */
export const PostSearchResponseSchema = PaginationResultSchema(PostSearchResultItemSchema);

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Post summary schema for quick display
 */
export const PostSummarySchema = PostSchema.pick({
    id: true,
    slug: true,
    title: true,
    summary: true,
    category: true,
    lifecycleState: true,
    isFeatured: true,
    publishedAt: true,
    readingTimeMinutes: true,
    media: true,
    authorId: true
});

/**
 * Post statistics schema
 */
export const PostStatsSchema = z.object({
    // Content statistics
    totalPosts: z.number().int().min(0).default(0),
    publishedPosts: z.number().int().min(0).default(0),
    draftPosts: z.number().int().min(0).default(0),
    featuredPosts: z.number().int().min(0).default(0),

    // Category distribution
    categoryDistribution: z
        .array(
            z.object({
                category: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional(),

    // Status distribution
    statusDistribution: z
        .object({
            draft: z.number().int().min(0).default(0),
            published: z.number().int().min(0).default(0),
            archived: z.number().int().min(0).default(0),
            scheduled: z.number().int().min(0).default(0)
        })
        .optional(),

    // Author statistics
    topAuthors: z
        .array(
            z.object({
                authorId: z.string().uuid(),
                authorName: z.string().optional(),
                postCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Publishing statistics
    postsPublishedToday: z.number().int().min(0).default(0),
    postsPublishedThisWeek: z.number().int().min(0).default(0),
    postsPublishedThisMonth: z.number().int().min(0).default(0),

    // Content metrics
    averageReadingTime: z.number().min(0).default(0),
    totalWords: z.number().int().min(0).default(0),

    // Media statistics
    postsWithMedia: z.number().int().min(0).default(0),
    postsWithFeaturedImage: z.number().int().min(0).default(0),

    // Engagement statistics
    totalViews: z.number().int().min(0).default(0),
    averageViewsPerPost: z.number().min(0).default(0),

    // Sponsorship statistics
    sponsoredPosts: z.number().int().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostFilters = z.infer<typeof PostFiltersSchema>;
export type PostSearchInput = z.infer<typeof PostSearchSchema>;
export type PostListItem = z.infer<typeof PostListItemSchema>;
export type PostSearchResultItem = z.infer<typeof PostSearchResultItemSchema>;
export type PostListResponse = z.infer<typeof PostListResponseSchema>;
export type PostSearchResponse = z.infer<typeof PostSearchResponseSchema>;
export type PostSummary = z.infer<typeof PostSummarySchema>;
export type PostStats = z.infer<typeof PostStatsSchema>;

// Compatibility aliases for existing code
export type PostListInput = PostSearchInput;
export type PostListOutput = PostListResponse;
export type PostSearchOutput = PostSearchResponse;
export type PostSearchResult = PostSearchResultItem;

// Legacy compatibility exports
export const PostListInputSchema = PostSearchSchema;
export const PostListOutputSchema = PostListResponseSchema;
export const PostSearchInputSchema = PostSearchSchema;
export const PostSearchOutputSchema = PostSearchResponseSchema;

// Additional missing legacy exports
export const PostSearchResultSchema = PostSearchResponseSchema;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible post search schema with query string coercion
 */
export const HttpPostSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    status: LifecycleStatusEnumSchema.optional(),
    category: PostCategoryEnumSchema.optional(),
    isFeatured: z.coerce.boolean().optional(),
    isPublished: z.coerce.boolean().optional(),

    // Author filters
    authorId: z.string().uuid().optional(),

    // Date filters with coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    publishedAfter: z.coerce.date().optional(),
    publishedBefore: z.coerce.date().optional(),

    // Content filters with coercion
    hasMedia: z.coerce.boolean().optional(),
    hasExcerpt: z.coerce.boolean().optional(),

    // Engagement filters with coercion
    minViews: z.coerce.number().int().min(0).optional(),
    maxViews: z.coerce.number().int().min(0).optional(),
    minLikes: z.coerce.number().int().min(0).optional(),
    maxLikes: z.coerce.number().int().min(0).optional(),
    minComments: z.coerce.number().int().min(0).optional(),
    maxComments: z.coerce.number().int().min(0).optional(),

    // Array filters (comma-separated)
    tags: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    authorIds: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpPostSearch = z.infer<typeof HttpPostSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for post search schema
 */
export const POST_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'PostSearch',
    description:
        'Schema for searching and filtering blog posts with content and engagement filters',
    title: 'Post Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'publishedAt',
        sortOrder: 'desc',
        q: 'travel tips',
        category: 'travel',
        isFeatured: true,
        isPublished: true,
        authorId: '123e4567-e89b-12d3-a456-426614174000',
        minViews: 100,
        hasMedia: true,
        tags: 'travel,tips,guide'
    },
    fields: {
        page: {
            description: 'Page number (1-based)',
            example: 1,
            minimum: 1
        },
        pageSize: {
            description: 'Number of items per page',
            example: 20,
            minimum: 1,
            maximum: 100
        },
        q: {
            description: 'Search query (searches title, content, excerpt)',
            example: 'travel tips',
            maxLength: 100
        },
        category: {
            description: 'Filter by post category',
            example: 'travel',
            enum: ['travel', 'accommodation', 'tips', 'guide', 'news', 'other']
        },
        isFeatured: {
            description: 'Filter featured posts',
            example: true
        },
        isPublished: {
            description: 'Filter published posts',
            example: true
        },
        authorId: {
            description: 'Filter by author UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        minViews: {
            description: 'Minimum view count',
            example: 100,
            minimum: 0
        },
        hasMedia: {
            description: 'Filter posts with media content',
            example: true
        },
        tags: {
            description: 'Comma-separated list of tags',
            example: 'travel,tips,guide'
        }
    },
    tags: ['posts', 'search']
};

/**
 * Post search schema with OpenAPI metadata applied
 */
export const PostSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpPostSearchSchema,
    POST_SEARCH_METADATA
);
