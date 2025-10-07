import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { TagSchema } from './tag.schema.js';

/**
 * Tag Query Schemas
 *
 * Standardized query schemas for tag operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for tags
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Tag-specific filters that extend the base search functionality
 */
export const TagFiltersSchema = z.object({
    // Basic filters
    name: z.string().optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),

    // Usage filters
    minUsageCount: z.number().int().min(0).optional(),
    maxUsageCount: z.number().int().min(0).optional(),
    isUnused: z.boolean().optional(),

    // Entity type filters
    usedInAccommodations: z.boolean().optional(),
    usedInDestinations: z.boolean().optional(),
    usedInPosts: z.boolean().optional(),
    usedInEvents: z.boolean().optional(),
    usedInUsers: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastUsedAfter: z.date().optional(),
    lastUsedBefore: z.date().optional(),

    // Name pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),

    // Length filters
    minNameLength: z.number().int().min(1).optional(),
    maxNameLength: z.number().int().min(1).optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete tag search schema combining base search with tag-specific filters
 * MIGRATED TO FLAT PATTERN: All filters are at the top level for HTTP compatibility
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Entity-specific filters: Flattened for consistency
 */
export const TagSearchSchema = BaseSearchSchema.extend({
    // Basic filters (flattened from TagFiltersSchema)
    name: z.string().optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),

    // Usage filters
    minUsageCount: z.number().int().min(0).optional(),
    maxUsageCount: z.number().int().min(0).optional(),
    isUnused: z.boolean().optional(),

    // Entity type filters
    usedInAccommodations: z.boolean().optional(),
    usedInDestinations: z.boolean().optional(),
    usedInPosts: z.boolean().optional(),
    usedInEvents: z.boolean().optional(),
    usedInUsers: z.boolean().optional(),

    // Date filters
    createdAfter: z.date().optional(),
    createdBefore: z.date().optional(),
    lastUsedAfter: z.date().optional(),
    lastUsedBefore: z.date().optional(),

    // Name pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),

    // Length filters
    minNameLength: z.number().int().min(1).optional(),
    maxNameLength: z.number().int().min(1).optional(),

    // Tag-specific search options
    fuzzySearch: z.boolean().default(true).optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Tag list item schema - contains essential fields for list display
 */
export const TagListItemSchema = TagSchema.pick({
    id: true,
    name: true,
    color: true,
    createdAt: true,
    updatedAt: true
}).extend({
    usageCount: z.number().int().min(0).default(0)
});

/**
 * Tag search result item - extends list item with search relevance score
 */
export const TagSearchResultItemSchema = TagListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Tag list response using standardized pagination format
 */
export const TagListResponseSchema = PaginationResultSchema(TagListItemSchema);

/**
 * Tag search response using standardized pagination format with search results
 */
export const TagSearchResponseSchema = PaginationResultSchema(TagSearchResultItemSchema);

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for popular tags input
 */
export const PopularTagsSchema = z.object({
    pageSize: z.number().int().min(1).max(100).default(20),
    entityType: z
        .enum(['all', 'accommodations', 'destinations', 'posts', 'events', 'users'])
        .default('all'),
    timeframe: z.enum(['all', 'year', 'month', 'week']).default('all')
});

/**
 * Enhanced popular tags response with usage breakdown
 */
export const PopularTagsResponseSchema = z.object({
    data: z.array(
        TagListItemSchema.extend({
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
    pagination: z.object({
        page: z.number().int().min(1),
        pageSize: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0)
    }),
    metadata: z
        .object({
            entityType: z.string(),
            timeframe: z.string(),
            totalTags: z.number().int().min(0),
            generatedAt: z.date()
        })
        .optional()
});

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Tag summary schema for quick display
 */
export const TagSummarySchema = TagSchema.pick({
    id: true,
    name: true,
    color: true
}).extend({
    usageCount: z.number().int().min(0).default(0)
});

/**
 * Tag statistics schema
 */
export const TagStatsSchema = z.object({
    // Basic statistics
    totalTags: z.number().int().min(0).default(0),
    unusedTags: z.number().int().min(0).default(0),
    totalUsages: z.number().int().min(0).default(0),
    averageUsagePerTag: z.number().min(0).default(0),

    // Usage distribution by entity type
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
    tagsCreatedToday: z.number().int().min(0).default(0),
    tagsCreatedThisWeek: z.number().int().min(0).default(0),
    tagsCreatedThisMonth: z.number().int().min(0).default(0),

    // Color distribution
    colorDistribution: z
        .array(
            z.object({
                color: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional(),

    // Name statistics
    averageNameLength: z.number().min(0).default(0),
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
export type TagSearchInput = z.infer<typeof TagSearchSchema>;
export type TagListItem = z.infer<typeof TagListItemSchema>;
export type TagSearchResultItem = z.infer<typeof TagSearchResultItemSchema>;
export type TagListResponse = z.infer<typeof TagListResponseSchema>;
export type TagSearchResponse = z.infer<typeof TagSearchResponseSchema>;
export type PopularTagsInput = z.infer<typeof PopularTagsSchema>;
export type PopularTagsResponse = z.infer<typeof PopularTagsResponseSchema>;
export type TagSummary = z.infer<typeof TagSummarySchema>;
export type TagStats = z.infer<typeof TagStatsSchema>;

// Compatibility aliases for existing code
export type TagListInput = TagSearchInput;
export type TagListOutput = TagListResponse;
export type TagSearchOutput = TagSearchResponse;
export type TagSearchResult = TagSearchResultItem;
export type PopularTagsOutput = PopularTagsResponse;

// Legacy compatibility exports
export const TagListInputSchema = TagSearchSchema;
export const TagListOutputSchema = TagListResponseSchema;
export const TagSearchInputSchema = TagSearchSchema;
export const TagSearchOutputSchema = TagSearchResponseSchema;
export const PopularTagsInputSchema = PopularTagsSchema;
export const PopularTagsOutputSchema = PopularTagsResponseSchema;

// Additional missing legacy exports
export const TagSearchResultSchema = TagSearchResponseSchema;

// Simple output for basic popular tags
export const PopularTagsSimpleOutputSchema = z.object({
    tags: z.array(TagSchema)
});

export type PopularTagsSimpleOutput = z.infer<typeof PopularTagsSimpleOutputSchema>;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible tag search schema with query string coercion
 */
export const HttpTagSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // Basic filters
    name: z.string().optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),

    // Usage filters with coercion
    minUsageCount: HttpQueryFields.minUsageCount(),
    maxUsageCount: HttpQueryFields.maxUsageCount(),
    isPopular: HttpQueryFields.isPopular(),

    // Date filters with coercion
    createdAfter: HttpQueryFields.createdAfter(),
    createdBefore: HttpQueryFields.createdBefore(),

    // Content filters with coercion
    hasDescription: HttpQueryFields.hasDescription(),

    // Pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),

    // Array filters (comma-separated)
    colors: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    categories: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpTagSearch = z.infer<typeof HttpTagSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for tag search schema
 */
export const TAG_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'TagSearch',
    description: 'Schema for searching and filtering tags with usage statistics and categorization',
    title: 'Tag Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'usageCount',
        sortOrder: 'desc',
        q: 'travel',
        isPopular: true,
        minUsageCount: 5,
        color: '#FF5733',
        nameContains: 'beach'
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
            description: 'Search query (searches name, description)',
            example: 'travel',
            maxLength: 100
        },
        isPopular: {
            description: 'Filter popular tags',
            example: true
        },
        minUsageCount: {
            description: 'Minimum usage count across entities',
            example: 5,
            minimum: 0
        },
        color: {
            description: 'Filter by exact color (hex format)',
            example: '#FF5733',
            pattern: '^#[0-9A-Fa-f]{6}$'
        },
        nameContains: {
            description: 'Filter tags whose names contain this text',
            example: 'beach',
            maxLength: 50
        }
    },
    tags: ['tags', 'search']
};

/**
 * Tag search schema with OpenAPI metadata applied
 */
export const TagSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpTagSearchSchema,
    TAG_SEARCH_METADATA
);
