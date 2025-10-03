import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpQueryFields,
    HttpSortingSchema
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { EntityTypeEnumSchema } from '../../enums/index.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { UserBookmarkSchema } from './userBookmark.schema.js';

/**
 * UserBookmark Query Schemas
 *
 * Standardized query schemas for user bookmark operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for user bookmarks
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * UserBookmark-specific filters that extend the base search functionality
 */
export const UserBookmarkFiltersSchema = z.object({
    // User filters
    userId: z.string().uuid().optional(),

    // Entity filters
    entityId: z.string().uuid().optional(),
    entityType: EntityTypeEnumSchema.optional(),

    // Date filters
    bookmarkedAfter: z.date().optional(),
    bookmarkedBefore: z.date().optional(),

    // Entity type grouping
    entityTypes: z.array(EntityTypeEnumSchema).optional(),

    // Collection/organization filters
    isPrivate: z.boolean().optional(),
    hasNotes: z.boolean().optional(),

    // Content-based filters
    notes: z.string().optional(),
    noteContains: z.string().optional()
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete user bookmark search schema combining base search with bookmark-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: UserBookmark-specific filtering options
 */
export const UserBookmarkSearchSchema = BaseSearchSchema.extend({
    filters: UserBookmarkFiltersSchema.optional()
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing bookmarks by user
 */
export const UserBookmarksByUserSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    entityType: EntityTypeEnumSchema.optional(),
    sortBy: z.enum(['createdAt', 'entityType', 'notes']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

/**
 * Schema for listing bookmarks by entity
 */
export const UserBookmarksByEntitySchema = z.object({
    entityId: z.string().uuid(),
    entityType: EntityTypeEnumSchema,
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['createdAt', 'userId']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
});

/**
 * Schema for counting bookmarks by entity
 */
export const UserBookmarkCountByEntitySchema = z.object({
    entityId: z.string().uuid(),
    entityType: EntityTypeEnumSchema
});

/**
 * Schema for counting bookmarks by user
 */
export const UserBookmarkCountByUserSchema = z.object({
    userId: z.string().uuid(),
    entityType: EntityTypeEnumSchema.optional()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * UserBookmark list item schema - contains essential fields for list display
 */
export const UserBookmarkListItemSchema = UserBookmarkSchema.pick({
    id: true,
    userId: true,
    entityId: true,
    entityType: true,
    notes: true,
    isPrivate: true,
    createdAt: true,
    updatedAt: true
});

/**
 * UserBookmark search result item - extends list item with search relevance score
 */
export const UserBookmarkSearchResultItemSchema = UserBookmarkListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * UserBookmark list response using standardized pagination format
 */
export const UserBookmarkListResponseSchema = PaginationResultSchema(UserBookmarkListItemSchema);

/**
 * UserBookmark search response using standardized pagination format with search results
 */
export const UserBookmarkSearchResponseSchema = PaginationResultSchema(
    UserBookmarkSearchResultItemSchema
);

/**
 * UserBookmark count response
 */
export const UserBookmarkCountResponseSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * UserBookmark summary schema for quick display
 */
export const UserBookmarkSummarySchema = UserBookmarkSchema.pick({
    id: true,
    userId: true,
    entityId: true,
    entityType: true,
    notes: true,
    createdAt: true
});

/**
 * UserBookmark statistics schema
 */
export const UserBookmarkStatsSchema = z.object({
    totalBookmarks: z.number().int().min(0).default(0),
    privateBookmarks: z.number().int().min(0).default(0),
    publicBookmarks: z.number().int().min(0).default(0),
    bookmarksWithNotes: z.number().int().min(0).default(0),

    // Entity type distribution
    bookmarksByEntityType: z.record(z.string(), z.number().int().min(0)).optional(),

    // User statistics
    totalUsers: z.number().int().min(0).default(0),
    averageBookmarksPerUser: z.number().min(0).default(0),

    // Popular entities
    mostBookmarkedEntities: z
        .array(
            z.object({
                entityId: z.string().uuid(),
                entityType: z.string(),
                bookmarkCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Active users
    mostActiveBookmarkers: z
        .array(
            z.object({
                userId: z.string().uuid(),
                bookmarkCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Recent activity
    bookmarksCreatedToday: z.number().int().min(0).default(0),
    bookmarksCreatedThisWeek: z.number().int().min(0).default(0),
    bookmarksCreatedThisMonth: z.number().int().min(0).default(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserBookmarkFilters = z.infer<typeof UserBookmarkFiltersSchema>;
export type UserBookmarkSearchInput = z.infer<typeof UserBookmarkSearchSchema>;
export type UserBookmarksByUserInput = z.infer<typeof UserBookmarksByUserSchema>;
export type UserBookmarksByEntityInput = z.infer<typeof UserBookmarksByEntitySchema>;
export type UserBookmarkCountByEntityInput = z.infer<typeof UserBookmarkCountByEntitySchema>;
export type UserBookmarkCountByUserInput = z.infer<typeof UserBookmarkCountByUserSchema>;
export type UserBookmarkListItem = z.infer<typeof UserBookmarkListItemSchema>;
export type UserBookmarkSearchResultItem = z.infer<typeof UserBookmarkSearchResultItemSchema>;
export type UserBookmarkListResponse = z.infer<typeof UserBookmarkListResponseSchema>;
export type UserBookmarkSearchResponse = z.infer<typeof UserBookmarkSearchResponseSchema>;
export type UserBookmarkCountResponse = z.infer<typeof UserBookmarkCountResponseSchema>;
export type UserBookmarkSummary = z.infer<typeof UserBookmarkSummarySchema>;
export type UserBookmarkStats = z.infer<typeof UserBookmarkStatsSchema>;

// Compatibility aliases for existing code
export type UserBookmarkListInput = UserBookmarkSearchInput;
export type UserBookmarkListOutput = UserBookmarkListResponse;
export type UserBookmarkSearchOutput = UserBookmarkSearchResponse;
export type UserBookmarkListByUserInput = UserBookmarksByUserInput;
export type UserBookmarkListByEntityInput = UserBookmarksByEntityInput;
export type UserBookmarkListByUserOutput = UserBookmarkListResponse;
export type UserBookmarkListByEntityOutput = UserBookmarkListResponse;
export type UserBookmarkCountOutput = UserBookmarkCountResponse;
export type UserBookmarkPaginatedListOutput = UserBookmarkListResponse;

// Legacy compatibility exports
export const UserBookmarkListInputSchema = UserBookmarkSearchSchema;
export const UserBookmarkListOutputSchema = UserBookmarkListResponseSchema;
export const UserBookmarkSearchInputSchema = UserBookmarkSearchSchema;
export const UserBookmarkSearchOutputSchema = UserBookmarkSearchResponseSchema;
export const UserBookmarkListByUserInputSchema = UserBookmarksByUserSchema;
export const UserBookmarkListByEntityInputSchema = UserBookmarksByEntitySchema;
export const UserBookmarkCountByEntityInputSchema = UserBookmarkCountByEntitySchema;
export const UserBookmarkCountByUserInputSchema = UserBookmarkCountByUserSchema;
export const UserBookmarkListByUserOutputSchema = UserBookmarkListResponseSchema;
export const UserBookmarkListByEntityOutputSchema = UserBookmarkListResponseSchema;
export const UserBookmarkCountOutputSchema = UserBookmarkCountResponseSchema;
export const UserBookmarkPaginatedListOutputSchema = UserBookmarkListResponseSchema;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible user bookmark search schema with query string coercion
 */
export const HttpUserBookmarkSearchSchema = HttpPaginationSchema.merge(HttpSortingSchema).extend({
    // Search
    q: z.string().optional(),

    // User filters
    userId: z.string().uuid().optional(),

    // Entity filters
    entityId: z.string().uuid().optional(),
    entityType: EntityTypeEnumSchema.optional(),

    // Date filters with coercion
    createdAfter: HttpQueryFields.createdAfter(),
    createdBefore: HttpQueryFields.createdBefore(),

    // Array filters (comma-separated)
    userIds: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    entityIds: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional(),
    entityTypes: z
        .string()
        .transform((val) => val.split(',').filter(Boolean))
        .optional()
});

export type HttpUserBookmarkSearch = z.infer<typeof HttpUserBookmarkSearchSchema>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for user bookmark search schema
 */
export const USER_BOOKMARK_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'UserBookmarkSearch',
    description: 'Schema for searching and filtering user bookmarks by entity type and date',
    title: 'User Bookmark Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        entityType: 'accommodation',
        createdAfter: '2025-01-01T00:00:00Z'
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
        userId: {
            description: 'Filter by user UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        entityType: {
            description: 'Filter by bookmarked entity type',
            example: 'accommodation',
            enum: ['accommodation', 'destination', 'attraction', 'event', 'post']
        },
        createdAfter: {
            description: 'Filter bookmarks created after this date',
            example: '2025-01-01T00:00:00Z',
            format: 'date-time'
        }
    },
    tags: ['bookmarks', 'search']
};

/**
 * User bookmark search schema with OpenAPI metadata applied
 */
export const UserBookmarkSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpUserBookmarkSearchSchema,
    USER_BOOKMARK_SEARCH_METADATA
);
