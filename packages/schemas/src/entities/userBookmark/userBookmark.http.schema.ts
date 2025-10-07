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
