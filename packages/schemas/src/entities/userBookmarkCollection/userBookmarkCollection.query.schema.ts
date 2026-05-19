import { z } from 'zod';
import {
    HttpPaginationSchema,
    HttpSortingSchema,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { type OpenApiSchemaMetadata, applyOpenApiMetadata } from '../../utils/openapi.utils.js';
import { UserBookmarkSchema } from '../userBookmark/userBookmark.schema.js';
import { UserBookmarkCollectionSchema } from './userBookmarkCollection.schema.js';

/**
 * UserBookmarkCollection Query Schemas
 *
 * Standardized query schemas for user bookmark collection operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for bookmark collections
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * UserBookmarkCollection-specific filters that extend the base search functionality.
 *
 * Designed for filtering a user's own collections. The service layer enforces
 * ownership, so `userId` here acts as a scoping filter, not an authorization bypass.
 */
export const UserBookmarkCollectionFiltersSchema = z.object({
    // Ownership filter — service enforces that the actor owns the userId
    userId: z.string().uuid().optional(),

    // Name-based text search (case-insensitive)
    nameContains: z.string().optional(),

    // Presence filter — only return collections with at least one bookmark
    hasBookmarks: z.boolean().optional(),

    // Embed bookmark count in each item response
    includeBookmarkCount: z.boolean().optional().default(false)
});

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete user bookmark collection search schema combining base search with
 * collection-specific filters. Follows the FLAT pattern for HTTP compatibility.
 *
 * Sort fields whitelist: `name`, `createdAt`, `bookmarkCount`.
 * `bookmarkCount` requires the `listActiveByUserWithBookmarkCount` model query.
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - Collection-specific filters: Flattened for HTTP query-string compatibility
 */
export const UserBookmarkCollectionSearchSchema = BaseSearchSchema.extend({
    // Ownership filter (flattened)
    userId: z.string().uuid().optional(),

    // Name-based text search
    nameContains: z.string().optional(),

    // Presence filter
    hasBookmarks: z.boolean().optional(),

    // Embed bookmark count in response items
    includeBookmarkCount: z.boolean().optional().default(false)
});

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing collections by user, with optional bookmark count.
 *
 * Enforces a whitelist of allowed sort fields to prevent injection via
 * `sortBy`. `bookmarkCount` is only safe when the model uses
 * `listActiveByUserWithBookmarkCount`.
 */
export const UserBookmarkCollectionsByUserSchema = z.object({
    userId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['name', 'createdAt', 'bookmarkCount']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    includeBookmarkCount: z.boolean().optional().default(false)
});

/**
 * Schema for counting collections by user.
 */
export const UserBookmarkCollectionCountByUserSchema = z.object({
    userId: z.string().uuid()
});

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * UserBookmarkCollection list item schema — essential fields for list display.
 */
export const UserBookmarkCollectionListItemSchema = UserBookmarkCollectionSchema.pick({
    id: true,
    userId: true,
    name: true,
    description: true,
    color: true,
    icon: true,
    createdAt: true,
    updatedAt: true
}).extend({
    /**
     * Number of bookmarks in this collection.
     * Only present when `includeBookmarkCount` is true in the query.
     */
    bookmarkCount: z.number().int().min(0).optional()
});

/**
 * UserBookmarkCollection search result item — extends list item with search relevance score.
 */
export const UserBookmarkCollectionSearchResultItemSchema =
    UserBookmarkCollectionListItemSchema.extend({
        score: z.number().min(0).max(1).optional()
    });

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Paginated list response for user bookmark collections.
 * Each item optionally carries `bookmarkCount` when requested via
 * `includeBookmarkCount: true`.
 */
export const UserBookmarkCollectionListResponseSchema = PaginationResultSchema(
    UserBookmarkCollectionListItemSchema
);

/**
 * Search response using standardized pagination format with optional relevance scores.
 */
export const UserBookmarkCollectionSearchResponseSchema = PaginationResultSchema(
    UserBookmarkCollectionSearchResultItemSchema
);

/**
 * Single collection detail response, optionally embedding a paginated page of
 * its bookmarks when the caller requests `includeBookmarks: true`.
 */
export const UserBookmarkCollectionDetailResponseSchema = UserBookmarkCollectionSchema.extend({
    /**
     * Optional embedded paginated list of bookmarks belonging to this collection.
     * Present only when the route/service resolves the relation.
     */
    bookmarks: PaginationResultSchema(
        UserBookmarkSchema.pick({
            id: true,
            entityId: true,
            entityType: true,
            name: true,
            description: true,
            createdAt: true
        }).extend({
            // Server-enriched display fields resolved from the referenced entity.
            // Nullable because the entity may have been soft-deleted or be of a
            // non-enrichable type (e.g. USER, ATTRACTION).
            entityName: z.string().nullable().optional(),
            entitySlug: z.string().nullable().optional(),
            entityImage: z.string().nullable().optional()
        })
    ).optional(),

    /** Precomputed bookmark count. Present when `includeBookmarkCount` was true. */
    bookmarkCount: z.number().int().min(0).optional()
});

/**
 * Count response for bookmark collection queries.
 */
export const UserBookmarkCollectionCountResponseSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * UserBookmarkCollection summary schema for quick display (e.g., dropdowns).
 */
export const UserBookmarkCollectionSummarySchema = UserBookmarkCollectionSchema.pick({
    id: true,
    userId: true,
    name: true,
    color: true,
    icon: true,
    createdAt: true
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserBookmarkCollectionFilters = z.infer<typeof UserBookmarkCollectionFiltersSchema>;
export type UserBookmarkCollectionSearchInput = z.infer<typeof UserBookmarkCollectionSearchSchema>;
export type UserBookmarkCollectionsByUserInput = z.infer<
    typeof UserBookmarkCollectionsByUserSchema
>;
export type UserBookmarkCollectionCountByUserInput = z.infer<
    typeof UserBookmarkCollectionCountByUserSchema
>;
export type UserBookmarkCollectionListItem = z.infer<typeof UserBookmarkCollectionListItemSchema>;
export type UserBookmarkCollectionSearchResultItem = z.infer<
    typeof UserBookmarkCollectionSearchResultItemSchema
>;
export type UserBookmarkCollectionListResponse = z.infer<
    typeof UserBookmarkCollectionListResponseSchema
>;
export type UserBookmarkCollectionSearchResponse = z.infer<
    typeof UserBookmarkCollectionSearchResponseSchema
>;
export type UserBookmarkCollectionDetailResponse = z.infer<
    typeof UserBookmarkCollectionDetailResponseSchema
>;
export type UserBookmarkCollectionCountResponse = z.infer<
    typeof UserBookmarkCollectionCountResponseSchema
>;
export type UserBookmarkCollectionSummary = z.infer<typeof UserBookmarkCollectionSummarySchema>;

// Compatibility aliases
export type UserBookmarkCollectionListInput = UserBookmarkCollectionSearchInput;
export type UserBookmarkCollectionListOutput = UserBookmarkCollectionListResponse;
export type UserBookmarkCollectionSearchOutput = UserBookmarkCollectionSearchResponse;
export type UserBookmarkCollectionListByUserInput = UserBookmarkCollectionsByUserInput;
export type UserBookmarkCollectionCountOutput = UserBookmarkCollectionCountResponse;
export type UserBookmarkCollectionPaginatedListOutput = UserBookmarkCollectionListResponse;

// Legacy schema aliases
export const UserBookmarkCollectionListInputSchema = UserBookmarkCollectionSearchSchema;
export const UserBookmarkCollectionListOutputSchema = UserBookmarkCollectionListResponseSchema;
export const UserBookmarkCollectionSearchInputSchema = UserBookmarkCollectionSearchSchema;
export const UserBookmarkCollectionSearchOutputSchema = UserBookmarkCollectionSearchResponseSchema;
export const UserBookmarkCollectionListByUserInputSchema = UserBookmarkCollectionsByUserSchema;
export const UserBookmarkCollectionCountByUserInputSchema = UserBookmarkCollectionCountByUserSchema;
export const UserBookmarkCollectionListByUserOutputSchema =
    UserBookmarkCollectionListResponseSchema;
export const UserBookmarkCollectionCountOutputSchema = UserBookmarkCollectionCountResponseSchema;
export const UserBookmarkCollectionPaginatedListOutputSchema =
    UserBookmarkCollectionListResponseSchema;

// ============================================================================
// HTTP-COMPATIBLE SCHEMAS
// ============================================================================

/**
 * HTTP-compatible user bookmark collection search schema with query string coercion.
 * Booleans use the `'true'/'false'` string coercion pattern from `createBooleanQueryParam`.
 */
export const HttpUserBookmarkCollectionSearchSchema = HttpPaginationSchema.merge(
    HttpSortingSchema
).extend({
    // Search
    q: z.string().optional(),

    // Ownership filter
    userId: z.string().uuid().optional(),

    // Name text search
    nameContains: z.string().optional(),

    // Boolean filters with HTTP string coercion
    hasBookmarks: createBooleanQueryParam('Filter collections with at least one bookmark'),
    includeBookmarkCount: createBooleanQueryParam(
        'When true, embed bookmarkCount in each collection item'
    )
});

export type HttpUserBookmarkCollectionSearch = z.infer<
    typeof HttpUserBookmarkCollectionSearchSchema
>;

// ============================================================================
// OPENAPI METADATA
// ============================================================================

/**
 * OpenAPI metadata for user bookmark collection search schema.
 */
export const USER_BOOKMARK_COLLECTION_SEARCH_METADATA: OpenApiSchemaMetadata = {
    ref: 'UserBookmarkCollectionSearch',
    description:
        'Schema for searching and filtering user bookmark collections by name, ownership, and bookmark presence',
    title: 'User Bookmark Collection Search Parameters',
    example: {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        hasBookmarks: 'true',
        includeBookmarkCount: 'true'
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
            description: 'Filter by owner user UUID',
            example: '123e4567-e89b-12d3-a456-426614174000',
            format: 'uuid'
        },
        nameContains: {
            description: 'Case-insensitive substring search on collection name',
            example: 'Viaje'
        },
        hasBookmarks: {
            description: 'When true, return only collections with at least one bookmark',
            example: 'true'
        },
        includeBookmarkCount: {
            description: 'When true, embed bookmarkCount per collection in the response',
            example: 'true'
        }
    },
    tags: ['bookmark-collections', 'search']
};

/**
 * User bookmark collection search schema with OpenAPI metadata applied.
 */
export const UserBookmarkCollectionSearchSchemaWithMetadata = applyOpenApiMetadata(
    HttpUserBookmarkCollectionSearchSchema,
    USER_BOOKMARK_COLLECTION_SEARCH_METADATA
);
