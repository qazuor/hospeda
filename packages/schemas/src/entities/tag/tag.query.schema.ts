import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { TagSchema } from './tag.schema.js';

/**
 * Tag Query Schemas
 *
 * This file contains all schemas related to querying tags:
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
 * Schema for tag-specific filters
 * Used in list and search operations
 */
export const TagFiltersSchema = z.object({
    // Basic filters
    color: z
        .string({
            message: 'zodError.tag.filters.color.invalidType'
        })
        .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'zodError.tag.filters.color.pattern' })
        .optional(),

    // Usage filters
    minUsageCount: z
        .number({
            message: 'zodError.tag.filters.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.tag.filters.minUsageCount.int' })
        .min(0, { message: 'zodError.tag.filters.minUsageCount.min' })
        .optional(),

    maxUsageCount: z
        .number({
            message: 'zodError.tag.filters.maxUsageCount.invalidType'
        })
        .int({ message: 'zodError.tag.filters.maxUsageCount.int' })
        .min(0, { message: 'zodError.tag.filters.maxUsageCount.min' })
        .optional(),

    isUnused: z
        .boolean({
            message: 'zodError.tag.filters.isUnused.invalidType'
        })
        .optional(),

    // Entity type filters
    usedInAccommodations: z
        .boolean({
            message: 'zodError.tag.filters.usedInAccommodations.invalidType'
        })
        .optional(),

    usedInDestinations: z
        .boolean({
            message: 'zodError.tag.filters.usedInDestinations.invalidType'
        })
        .optional(),

    usedInPosts: z
        .boolean({
            message: 'zodError.tag.filters.usedInPosts.invalidType'
        })
        .optional(),

    usedInEvents: z
        .boolean({
            message: 'zodError.tag.filters.usedInEvents.invalidType'
        })
        .optional(),

    usedInUsers: z
        .boolean({
            message: 'zodError.tag.filters.usedInUsers.invalidType'
        })
        .optional(),

    // Date filters
    createdAfter: z
        .date({
            message: 'zodError.tag.filters.createdAfter.invalidType'
        })
        .optional(),

    createdBefore: z
        .date({
            message: 'zodError.tag.filters.createdBefore.invalidType'
        })
        .optional(),

    lastUsedAfter: z
        .date({
            message: 'zodError.tag.filters.lastUsedAfter.invalidType'
        })
        .optional(),

    lastUsedBefore: z
        .date({
            message: 'zodError.tag.filters.lastUsedBefore.invalidType'
        })
        .optional(),

    // Name pattern filters
    nameStartsWith: z
        .string({
            message: 'zodError.tag.filters.nameStartsWith.invalidType'
        })
        .min(1, { message: 'zodError.tag.filters.nameStartsWith.min' })
        .max(50, { message: 'zodError.tag.filters.nameStartsWith.max' })
        .optional(),

    nameEndsWith: z
        .string({
            message: 'zodError.tag.filters.nameEndsWith.invalidType'
        })
        .min(1, { message: 'zodError.tag.filters.nameEndsWith.min' })
        .max(50, { message: 'zodError.tag.filters.nameEndsWith.max' })
        .optional(),

    nameContains: z
        .string({
            message: 'zodError.tag.filters.nameContains.invalidType'
        })
        .min(1, { message: 'zodError.tag.filters.nameContains.min' })
        .max(50, { message: 'zodError.tag.filters.nameContains.max' })
        .optional(),

    // Length filters
    minNameLength: z
        .number({
            message: 'zodError.tag.filters.minNameLength.invalidType'
        })
        .int({ message: 'zodError.tag.filters.minNameLength.int' })
        .min(1, { message: 'zodError.tag.filters.minNameLength.min' })
        .optional(),

    maxNameLength: z
        .number({
            message: 'zodError.tag.filters.maxNameLength.invalidType'
        })
        .int({ message: 'zodError.tag.filters.maxNameLength.int' })
        .min(1, { message: 'zodError.tag.filters.maxNameLength.min' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for tag list input parameters
 * Includes pagination and filters
 */
export const TagListInputSchema = PaginationSchema.extend({
    filters: TagFiltersSchema.optional(),
    sortBy: z
        .enum(['name', 'usageCount', 'createdAt', 'lastUsedAt'], {
            message: 'zodError.tag.list.sortBy.enum'
        })
        .optional()
        .default('name'),
    sortOrder: z
        .enum(['asc', 'desc'], {
            message: 'zodError.tag.list.sortOrder.enum'
        })
        .optional()
        .default('asc')
});

/**
 * Schema for individual tag items in lists
 * Contains essential fields for list display
 */
export const TagListItemSchema = TagSchema.pick({
    id: true,
    name: true,
    color: true,
    usageCount: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for tag list output
 * Uses generic paginated response with list items
 */
export const TagListOutputSchema = z.object({
    items: z.array(TagListItemSchema),
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
 * Schema for tag search input parameters
 * Extends base search with tag-specific filters
 */
export const TagSearchInputSchema = BaseSearchSchema.extend({
    filters: TagFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.tag.search.query.invalidType'
        })
        .min(1, { message: 'zodError.tag.search.query.min' })
        .max(100, { message: 'zodError.tag.search.query.max' })
        .optional(),
    fuzzySearch: z
        .boolean({
            message: 'zodError.tag.search.fuzzySearch.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for individual tag search results
 * Extends list item with search score
 */
export const TagSearchResultSchema = TagListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.tag.search.score.invalidType'
        })
        .min(0, { message: 'zodError.tag.search.score.min' })
        .max(1, { message: 'zodError.tag.search.score.max' })
        .optional()
});

/**
 * Schema for tag search output
 * Uses generic paginated response with search results
 */
export const TagSearchOutputSchema = z.object({
    items: z.array(TagSearchResultSchema),
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
            totalResults: z.number().min(0),
            fuzzySearchUsed: z.boolean().optional()
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for tag summary
 * Contains essential information for quick display
 */
export const TagSummarySchema = TagSchema.pick({
    id: true,
    name: true,
    color: true,
    usageCount: true
});

// ============================================================================
// POPULAR TAGS SCHEMA
// ============================================================================

/**
 * Schema for popular tags input
 * Parameters for fetching popular tags
 */
export const PopularTagsInputSchema = z.object({
    limit: z
        .number({
            message: 'zodError.tag.popular.limit.invalidType'
        })
        .int({ message: 'zodError.tag.popular.limit.int' })
        .min(1, { message: 'zodError.tag.popular.limit.min' })
        .max(100, { message: 'zodError.tag.popular.limit.max' })
        .optional()
        .default(20),
    entityType: z
        .enum(['all', 'accommodations', 'destinations', 'posts', 'events', 'users'], {
            message: 'zodError.tag.popular.entityType.enum'
        })
        .optional()
        .default('all'),
    timeframe: z
        .enum(['all', 'year', 'month', 'week'], {
            message: 'zodError.tag.popular.timeframe.enum'
        })
        .optional()
        .default('all')
});

/**
 * Schema for popular tags output
 * Returns list of popular tags with usage statistics
 */
export const PopularTagsOutputSchema = z.object({
    tags: z.array(
        TagSummarySchema.extend({
            recentUsageCount: z.number().int().min(0).optional(),
            growthRate: z.number().optional(),
            entityBreakdown: z
                .object({
                    accommodations: z.number().int().min(0).default(0),
                    destinations: z.number().int().min(0).default(0),
                    posts: z.number().int().min(0).default(0),
                    events: z.number().int().min(0).default(0),
                    users: z.number().int().min(0).default(0)
                })
                .optional()
        })
    ),
    metadata: z.object({
        entityType: z.string(),
        timeframe: z.string(),
        totalTags: z.number().int().min(0),
        generatedAt: z.date()
    })
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for tag statistics
 * Contains metrics and analytics data
 */
export const TagStatsSchema = z.object({
    // Basic statistics
    totalTags: z
        .number({
            message: 'zodError.tag.stats.totalTags.invalidType'
        })
        .int({ message: 'zodError.tag.stats.totalTags.int' })
        .min(0, { message: 'zodError.tag.stats.totalTags.min' })
        .default(0),

    unusedTags: z
        .number({
            message: 'zodError.tag.stats.unusedTags.invalidType'
        })
        .int({ message: 'zodError.tag.stats.unusedTags.int' })
        .min(0, { message: 'zodError.tag.stats.unusedTags.min' })
        .default(0),

    totalUsages: z
        .number({
            message: 'zodError.tag.stats.totalUsages.invalidType'
        })
        .int({ message: 'zodError.tag.stats.totalUsages.int' })
        .min(0, { message: 'zodError.tag.stats.totalUsages.min' })
        .default(0),

    averageUsagePerTag: z
        .number({
            message: 'zodError.tag.stats.averageUsagePerTag.invalidType'
        })
        .min(0, { message: 'zodError.tag.stats.averageUsagePerTag.min' })
        .default(0),

    // Usage distribution
    usageDistribution: z
        .object({
            accommodations: z.number().int().min(0).default(0),
            destinations: z.number().int().min(0).default(0),
            posts: z.number().int().min(0).default(0),
            events: z.number().int().min(0).default(0),
            users: z.number().int().min(0).default(0)
        })
        .optional(),

    // Popular tags
    mostUsedTags: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                usageCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Recent activity
    tagsCreatedToday: z
        .number({
            message: 'zodError.tag.stats.tagsCreatedToday.invalidType'
        })
        .int({ message: 'zodError.tag.stats.tagsCreatedToday.int' })
        .min(0, { message: 'zodError.tag.stats.tagsCreatedToday.min' })
        .default(0),

    tagsCreatedThisWeek: z
        .number({
            message: 'zodError.tag.stats.tagsCreatedThisWeek.invalidType'
        })
        .int({ message: 'zodError.tag.stats.tagsCreatedThisWeek.int' })
        .min(0, { message: 'zodError.tag.stats.tagsCreatedThisWeek.min' })
        .default(0),

    tagsCreatedThisMonth: z
        .number({
            message: 'zodError.tag.stats.tagsCreatedThisMonth.invalidType'
        })
        .int({ message: 'zodError.tag.stats.tagsCreatedThisMonth.int' })
        .min(0, { message: 'zodError.tag.stats.tagsCreatedThisMonth.min' })
        .default(0),

    // Color distribution
    colorDistribution: z
        .array(
            z.object({
                color: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional(),

    // Name length statistics
    averageNameLength: z
        .number({
            message: 'zodError.tag.stats.averageNameLength.invalidType'
        })
        .min(0, { message: 'zodError.tag.stats.averageNameLength.min' })
        .default(0),

    nameLengthDistribution: z
        .object({
            short: z.number().int().min(0).default(0), // 1-5 chars
            medium: z.number().int().min(0).default(0), // 6-15 chars
            long: z.number().int().min(0).default(0) // 16+ chars
        })
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TagFilters = z.infer<typeof TagFiltersSchema>;
export type TagListInput = z.infer<typeof TagListInputSchema>;
export type TagListItem = z.infer<typeof TagListItemSchema>;
export type TagListOutput = z.infer<typeof TagListOutputSchema>;
export type TagSearchInput = z.infer<typeof TagSearchInputSchema>;
export type TagSearchResult = z.infer<typeof TagSearchResultSchema>;
export type TagSearchOutput = z.infer<typeof TagSearchOutputSchema>;
export type TagSummary = z.infer<typeof TagSummarySchema>;
export type PopularTagsInput = z.infer<typeof PopularTagsInputSchema>;
export type PopularTagsOutput = z.infer<typeof PopularTagsOutputSchema>;
export type TagStats = z.infer<typeof TagStatsSchema>;
