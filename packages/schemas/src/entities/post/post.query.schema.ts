import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { LifecycleStatusEnumSchema, PostCategoryEnumSchema } from '../../enums/index.js';
import { PostSchema } from './post.schema.js';

/**
 * Post Query Schemas
 *
 * This file contains all schemas related to querying posts:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Summary
 * - Stats
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for post-specific filters
 * Used in list and search operations
 */
export const PostFiltersSchema = z.object({
    // Basic filters
    status: LifecycleStatusEnumSchema.optional(),
    category: PostCategoryEnumSchema.optional(),
    isFeatured: z
        .boolean({
            message: 'zodError.post.filters.isFeatured.invalidType'
        })
        .optional(),

    isPublished: z
        .boolean({
            message: 'zodError.post.filters.isPublished.invalidType'
        })
        .optional(),

    // Author filters
    authorId: z
        .string({
            message: 'zodError.post.filters.authorId.invalidType'
        })
        .uuid({ message: 'zodError.post.filters.authorId.uuid' })
        .optional(),

    // Date filters
    publishedAfter: z
        .date({
            message: 'zodError.post.filters.publishedAfter.invalidType'
        })
        .optional(),

    publishedBefore: z
        .date({
            message: 'zodError.post.filters.publishedBefore.invalidType'
        })
        .optional(),

    createdAfter: z
        .date({
            message: 'zodError.post.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.post.filters.createdBefore.invalidType'
        })
        .optional(),

    // Content filters
    hasMedia: z
        .boolean({
            message: 'zodError.post.filters.hasMedia.invalidType'
        })
        .optional(),

    hasFeaturedImage: z
        .boolean({
            message: 'zodError.post.filters.hasFeaturedImage.invalidType'
        })
        .optional(),

    // Reading time filters
    minReadingTime: z
        .number({
            message: 'zodError.post.filters.minReadingTime.invalidType'
        })
        .int({ message: 'zodError.post.filters.minReadingTime.int' })
        .min(1, { message: 'zodError.post.filters.minReadingTime.min' })
        .optional(),

    maxReadingTime: z
        .number({
            message: 'zodError.post.filters.maxReadingTime.invalidType'
        })
        .int({ message: 'zodError.post.filters.maxReadingTime.int' })
        .min(1, { message: 'zodError.post.filters.maxReadingTime.min' })
        .optional(),

    // Tags filter
    tags: z.array(z.string().uuid({ message: 'zodError.post.filters.tags.item.uuid' })).optional(),

    // Related entities
    destinationId: z
        .string({
            message: 'zodError.post.filters.destinationId.invalidType'
        })
        .uuid({ message: 'zodError.post.filters.destinationId.uuid' })
        .optional(),

    accommodationId: z
        .string({
            message: 'zodError.post.filters.accommodationId.invalidType'
        })
        .uuid({ message: 'zodError.post.filters.accommodationId.uuid' })
        .optional(),

    eventId: z
        .string({
            message: 'zodError.post.filters.eventId.invalidType'
        })
        .uuid({ message: 'zodError.post.filters.eventId.uuid' })
        .optional(),

    // Sponsorship filters
    isSponsored: z
        .boolean({
            message: 'zodError.post.filters.isSponsored.invalidType'
        })
        .optional(),

    sponsorId: z
        .string({
            message: 'zodError.post.filters.sponsorId.invalidType'
        })
        .uuid({ message: 'zodError.post.filters.sponsorId.uuid' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for post list input parameters
 * Includes pagination and filters
 */
export const PostListInputSchema = PaginationSchema.extend({
    filters: PostFiltersSchema.optional()
});

/**
 * Schema for individual post items in lists
 * Contains essential fields for list display
 */
export const PostListItemSchema = PostSchema.pick({
    id: true,
    slug: true,
    title: true,
    summary: true,
    category: true,
    status: true,
    isFeatured: true,
    publishedAt: true,
    readingTimeMinutes: true,
    media: true,
    authorId: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for post list output
 * Uses generic paginated response with list items
 */
export const PostListOutputSchema = z.object({
    items: z.array(PostListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for post search input parameters
 * Extends base search with post-specific filters
 */
export const PostSearchInputSchema = BaseSearchSchema.extend({
    filters: PostFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.post.search.query.invalidType'
        })
        .min(1, { message: 'zodError.post.search.query.min' })
        .max(100, { message: 'zodError.post.search.query.max' })
        .optional()
});

/**
 * Schema for individual post search results
 * Extends list item with search score
 */
export const PostSearchResultSchema = PostListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.post.search.score.invalidType'
        })
        .min(0, { message: 'zodError.post.search.score.min' })
        .max(1, { message: 'zodError.post.search.score.max' })
        .optional()
});

/**
 * Schema for post search output
 * Uses generic paginated response with search results
 */
export const PostSearchOutputSchema = z.object({
    items: z.array(PostSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0)
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for post summary
 * Contains essential information for quick display
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

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for post statistics
 * Contains metrics and analytics data
 */
export const PostStatsSchema = z.object({
    // Content statistics
    totalPosts: z
        .number({
            message: 'zodError.post.stats.totalPosts.invalidType'
        })
        .int({ message: 'zodError.post.stats.totalPosts.int' })
        .min(0, { message: 'zodError.post.stats.totalPosts.min' })
        .default(0),

    publishedPosts: z
        .number({
            message: 'zodError.post.stats.publishedPosts.invalidType'
        })
        .int({ message: 'zodError.post.stats.publishedPosts.int' })
        .min(0, { message: 'zodError.post.stats.publishedPosts.min' })
        .default(0),

    draftPosts: z
        .number({
            message: 'zodError.post.stats.draftPosts.invalidType'
        })
        .int({ message: 'zodError.post.stats.draftPosts.int' })
        .min(0, { message: 'zodError.post.stats.draftPosts.min' })
        .default(0),

    featuredPosts: z
        .number({
            message: 'zodError.post.stats.featuredPosts.invalidType'
        })
        .int({ message: 'zodError.post.stats.featuredPosts.int' })
        .min(0, { message: 'zodError.post.stats.featuredPosts.min' })
        .default(0),

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
    postsPublishedToday: z
        .number({
            message: 'zodError.post.stats.postsPublishedToday.invalidType'
        })
        .int({ message: 'zodError.post.stats.postsPublishedToday.int' })
        .min(0, { message: 'zodError.post.stats.postsPublishedToday.min' })
        .default(0),

    postsPublishedThisWeek: z
        .number({
            message: 'zodError.post.stats.postsPublishedThisWeek.invalidType'
        })
        .int({ message: 'zodError.post.stats.postsPublishedThisWeek.int' })
        .min(0, { message: 'zodError.post.stats.postsPublishedThisWeek.min' })
        .default(0),

    postsPublishedThisMonth: z
        .number({
            message: 'zodError.post.stats.postsPublishedThisMonth.invalidType'
        })
        .int({ message: 'zodError.post.stats.postsPublishedThisMonth.int' })
        .min(0, { message: 'zodError.post.stats.postsPublishedThisMonth.min' })
        .default(0),

    // Content metrics
    averageReadingTime: z
        .number({
            message: 'zodError.post.stats.averageReadingTime.invalidType'
        })
        .min(0, { message: 'zodError.post.stats.averageReadingTime.min' })
        .default(0),

    totalWords: z
        .number({
            message: 'zodError.post.stats.totalWords.invalidType'
        })
        .int({ message: 'zodError.post.stats.totalWords.int' })
        .min(0, { message: 'zodError.post.stats.totalWords.min' })
        .default(0),

    // Media statistics
    postsWithMedia: z
        .number({
            message: 'zodError.post.stats.postsWithMedia.invalidType'
        })
        .int({ message: 'zodError.post.stats.postsWithMedia.int' })
        .min(0, { message: 'zodError.post.stats.postsWithMedia.min' })
        .default(0),

    postsWithFeaturedImage: z
        .number({
            message: 'zodError.post.stats.postsWithFeaturedImage.invalidType'
        })
        .int({ message: 'zodError.post.stats.postsWithFeaturedImage.int' })
        .min(0, { message: 'zodError.post.stats.postsWithFeaturedImage.min' })
        .default(0),

    // Engagement statistics (if available)
    totalViews: z
        .number({
            message: 'zodError.post.stats.totalViews.invalidType'
        })
        .int({ message: 'zodError.post.stats.totalViews.int' })
        .min(0, { message: 'zodError.post.stats.totalViews.min' })
        .default(0),

    averageViewsPerPost: z
        .number({
            message: 'zodError.post.stats.averageViewsPerPost.invalidType'
        })
        .min(0, { message: 'zodError.post.stats.averageViewsPerPost.min' })
        .default(0),

    // Sponsorship statistics
    sponsoredPosts: z
        .number({
            message: 'zodError.post.stats.sponsoredPosts.invalidType'
        })
        .int({ message: 'zodError.post.stats.sponsoredPosts.int' })
        .min(0, { message: 'zodError.post.stats.sponsoredPosts.min' })
        .default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostFilters = z.infer<typeof PostFiltersSchema>;
export type PostListInput = z.infer<typeof PostListInputSchema>;
export type PostListItem = z.infer<typeof PostListItemSchema>;
export type PostListOutput = z.infer<typeof PostListOutputSchema>;
export type PostSearchInput = z.infer<typeof PostSearchInputSchema>;
export type PostSearchResult = z.infer<typeof PostSearchResultSchema>;
export type PostSearchOutput = z.infer<typeof PostSearchOutputSchema>;
export type PostSummary = z.infer<typeof PostSummarySchema>;
export type PostStats = z.infer<typeof PostStatsSchema>;
