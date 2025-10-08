/**
 * User Bookmark HTTP Schemas
 *
 * HTTP-compatible schemas for user bookmark operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible user bookmark search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const UserBookmarkSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Entity relation filters with HTTP coercion
    userId: z.string().uuid().optional(),
    accommodationId: z.string().uuid().optional(),
    destinationId: z.string().uuid().optional(),
    postId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    eventId: z.string().uuid().optional(),

    // Bookmark type filters
    hasAccommodation: createBooleanQueryParam('Filter bookmarks with accommodations'),
    hasDestination: createBooleanQueryParam('Filter bookmarks with destinations'),
    hasPost: createBooleanQueryParam('Filter bookmarks with posts'),
    hasTag: createBooleanQueryParam('Filter bookmarks with tags'),
    hasEvent: createBooleanQueryParam('Filter bookmarks with events'),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    updatedAfter: z.coerce.date().optional(),
    updatedBefore: z.coerce.date().optional(),

    // User behavior filters
    isActive: createBooleanQueryParam('Filter active bookmarks'),
    recentActivity: createBooleanQueryParam('Filter recently active bookmarks'),

    // Entity status filters
    accommodationIsActive: createBooleanQueryParam('Filter by accommodation active status'),
    destinationIsPublic: createBooleanQueryParam('Filter by destination public status'),
    postIsPublished: createBooleanQueryParam('Filter by post published status'),
    eventIsPublic: createBooleanQueryParam('Filter by event public status'),

    // Array filters with HTTP coercion
    userIds: createArrayQueryParam('Filter by multiple user IDs'),
    accommodationIds: createArrayQueryParam('Filter by multiple accommodation IDs'),
    destinationIds: createArrayQueryParam('Filter by multiple destination IDs'),
    postIds: createArrayQueryParam('Filter by multiple post IDs'),
    tagIds: createArrayQueryParam('Filter by multiple tag IDs'),
    eventIds: createArrayQueryParam('Filter by multiple event IDs'),

    // Advanced filters
    hasAnyBookmark: createBooleanQueryParam('Filter users with any bookmarks'),
    bookmarkCount: z.coerce.number().min(0).optional(),
    minBookmarks: z.coerce.number().min(0).optional(),
    maxBookmarks: z.coerce.number().min(0).optional(),

    // Content type grouping
    bookmarkType: z.enum(['accommodation', 'destination', 'post', 'tag', 'event']).optional(),
    excludeBookmarkType: z
        .enum(['accommodation', 'destination', 'post', 'tag', 'event'])
        .optional(),

    // Search and sorting options
    includeEntityDetails: createBooleanQueryParam('Include related entity details'),
    sortByMostRecent: createBooleanQueryParam('Sort by most recent bookmarks'),
    sortByEntityType: createBooleanQueryParam('Sort by entity type')
});

export type UserBookmarkSearchHttp = z.infer<typeof UserBookmarkSearchHttpSchema>;

/**
 * HTTP-compatible user bookmark creation schema
 * Handles form data and JSON input for creating bookmarks via HTTP
 */
export const UserBookmarkCreateHttpSchema = z
    .object({
        userId: z.string().uuid(),
        // At least one entity must be bookmarked
        accommodationId: z.string().uuid().optional(),
        destinationId: z.string().uuid().optional(),
        postId: z.string().uuid().optional(),
        tagId: z.string().uuid().optional(),
        eventId: z.string().uuid().optional(),

        // Optional bookmark metadata
        notes: z.string().optional(),
        priority: z.coerce.number().min(1).max(5).optional(),
        isPrivate: z.coerce.boolean().optional()
    })
    .refine(
        (data) =>
            data.accommodationId || data.destinationId || data.postId || data.tagId || data.eventId,
        {
            message: 'At least one entity must be bookmarked'
        }
    );

export type UserBookmarkCreateHttp = z.infer<typeof UserBookmarkCreateHttpSchema>;

/**
 * HTTP-compatible user bookmark update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const UserBookmarkUpdateHttpSchema = z.object({
    notes: z.string().optional(),
    priority: z.coerce.number().min(1).max(5).optional(),
    isPrivate: z.coerce.boolean().optional(),
    isActive: z.coerce.boolean().optional()
});

export type UserBookmarkUpdateHttp = z.infer<typeof UserBookmarkUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { UserBookmarkSearchInput } from './userBookmark.query.schema.js';

import type {
    UserBookmarkCreateInput,
    UserBookmarkUpdateInput
} from './userBookmark.crud.schema.js';

import { EntityTypeEnum } from '../../enums/entity-type.enum.js';

/**
 * Convert HTTP user bookmark search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 * Note: HTTP has specific entity IDs but domain uses generic entityType/entityId
 */
export const httpToDomainUserBookmarkSearch = (
    httpParams: UserBookmarkSearchHttp
): UserBookmarkSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Available filters
        userId: httpParams.userId,
        entityId:
            httpParams.accommodationId ||
            httpParams.destinationId ||
            httpParams.postId ||
            httpParams.tagId ||
            httpParams.eventId

        // Note: many HTTP-specific filters not available in domain search
    };
};

/**
 * Convert HTTP user bookmark create data to domain create input
 * Handles form data conversion to proper domain types
 * Determines entityType based on which ID is provided
 */
export const httpToDomainUserBookmarkCreate = (
    httpData: UserBookmarkCreateHttp
): UserBookmarkCreateInput => {
    // Determine entity type and ID from the provided data
    let entityType: EntityTypeEnum;
    let entityId: string;

    if (httpData.accommodationId) {
        entityType = EntityTypeEnum.ACCOMMODATION;
        entityId = httpData.accommodationId;
    } else if (httpData.destinationId) {
        entityType = EntityTypeEnum.DESTINATION;
        entityId = httpData.destinationId;
    } else if (httpData.postId) {
        entityType = EntityTypeEnum.POST;
        entityId = httpData.postId;
    } else if (httpData.eventId) {
        entityType = EntityTypeEnum.EVENT;
        entityId = httpData.eventId;
    } else {
        // Default fallback (should not happen due to HTTP schema validation)
        entityType = EntityTypeEnum.ACCOMMODATION;
        entityId = httpData.tagId || '';
    }

    return {
        userId: httpData.userId,
        entityId,
        entityType,
        name: undefined, // Not available in HTTP schema
        description: httpData.notes // Map notes to description
    };
};

/**
 * Convert HTTP user bookmark update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 * Note: Update schema only allows updating the bookmark itself, not entity references
 */
export const httpToDomainUserBookmarkUpdate = (
    httpData: UserBookmarkUpdateHttp
): UserBookmarkUpdateInput => {
    // For updates, we need the required fields. Since they're not available in HTTP update,
    // this function is simplified to handle only description changes.
    // In practice, the entity reference fields would come from the existing bookmark.
    return {
        description: httpData.notes // Map notes to description
        // Note: userId, entityId, entityType are typically not updated and would come from existing entity
    } as UserBookmarkUpdateInput;
};
