/**
 * User Bookmark Collection HTTP Schemas
 *
 * HTTP-compatible schemas for user bookmark collection operations with automatic
 * query string coercion. These schemas handle the conversion from HTTP query
 * parameters (strings) to properly typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import type {
    UserBookmarkCollectionCreateInput,
    UserBookmarkCollectionUpdateInput
} from './userBookmarkCollection.crud.schema.js';
import type { UserBookmarkCollectionSearchInput } from './userBookmarkCollection.query.schema.js';

// ============================================================================
// REQUEST SCHEMAS (HTTP → Domain coercion layer)
// ============================================================================

/**
 * HTTP-compatible user bookmark collection search schema with automatic coercion.
 * Uses the FLAT filter pattern for HTTP compatibility.
 *
 * Boolean fields are coerced from the `'true'/'false'` string literals that
 * arrive from query strings. Date fields are coerced from ISO strings.
 */
export const UserBookmarkCollectionSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Ownership filter
    userId: z.string().uuid().optional(),

    // Name-based text search
    nameContains: z.string().optional(),

    // Boolean filters with HTTP string coercion
    hasBookmarks: createBooleanQueryParam('Filter collections with at least one bookmark'),
    includeBookmarkCount: createBooleanQueryParam(
        'When true, embed bookmarkCount in each collection item'
    ),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional()
});

export type UserBookmarkCollectionSearchHttp = z.infer<
    typeof UserBookmarkCollectionSearchHttpSchema
>;

/**
 * HTTP-compatible user bookmark collection creation schema.
 * Handles both JSON body and form-data input for creating collections via HTTP.
 *
 * `userId` must be provided in the body (typically populated server-side from
 * the session, but accepted here for flexibility at the HTTP boundary).
 */
export const UserBookmarkCollectionCreateHttpSchema = z
    .object({
        userId: z.string().uuid(),
        name: z.string().min(1).max(60),
        description: z.string().max(300).optional(),
        color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/, {
                message: 'zodError.userBookmarkCollection.color.invalidHex'
            })
            .optional(),
        icon: z.string().max(40).optional()
    })
    .strict();

export type UserBookmarkCollectionCreateHttp = z.infer<
    typeof UserBookmarkCollectionCreateHttpSchema
>;

/**
 * HTTP-compatible user bookmark collection update schema.
 * Handles partial updates via HTTP PATCH requests.
 *
 * `id` and `userId` are intentionally excluded — they come from path params,
 * not the request body.
 */
export const UserBookmarkCollectionUpdateHttpSchema = z
    .object({
        name: z.string().min(1).max(60).optional(),
        description: z.string().max(300).optional(),
        color: z
            .string()
            .regex(/^#[0-9A-Fa-f]{6}$/, {
                message: 'zodError.userBookmarkCollection.color.invalidHex'
            })
            .optional(),
        icon: z.string().max(40).optional()
    })
    .strict();

export type UserBookmarkCollectionUpdateHttp = z.infer<
    typeof UserBookmarkCollectionUpdateHttpSchema
>;

// ============================================================================
// RESPONSE ENVELOPE SCHEMAS
// ============================================================================

/**
 * Standard pagination metadata envelope shared across list responses.
 */
const PaginationMetaSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean()
});

/**
 * Single-item response envelope for create/detail operations.
 * Wraps a `UserBookmarkCollection` under the `data` key, matching
 * the project's `ResponseFactory` output shape.
 */
export const UserBookmarkCollectionSingleResponseHttpSchema = z.object({
    data: z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        lifecycleState: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        bookmarkCount: z.number().int().min(0).optional()
    })
});

export type UserBookmarkCollectionSingleResponseHttp = z.infer<
    typeof UserBookmarkCollectionSingleResponseHttpSchema
>;

/**
 * Paginated list response envelope for collection list operations.
 */
export const UserBookmarkCollectionListResponseHttpSchema = z.object({
    data: z.array(
        z.object({
            id: z.string().uuid(),
            userId: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable().optional(),
            color: z.string().nullable().optional(),
            icon: z.string().nullable().optional(),
            createdAt: z.date(),
            updatedAt: z.date(),
            bookmarkCount: z.number().int().min(0).optional()
        })
    ),
    pagination: PaginationMetaSchema
});

export type UserBookmarkCollectionListResponseHttp = z.infer<
    typeof UserBookmarkCollectionListResponseHttpSchema
>;

/**
 * Detail response envelope for a single collection with optional embedded bookmarks.
 * Used by GET `/user-bookmark-collections/:id` when the caller requests bookmark data.
 */
export const UserBookmarkCollectionDetailResponseHttpSchema = z.object({
    data: z.object({
        id: z.string().uuid(),
        userId: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        lifecycleState: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        bookmarkCount: z.number().int().min(0).optional(),
        bookmarks: z
            .object({
                data: z.array(
                    z.object({
                        id: z.string().uuid(),
                        entityId: z.string().uuid(),
                        entityType: z.string(),
                        name: z.string().optional(),
                        createdAt: z.date()
                    })
                ),
                pagination: PaginationMetaSchema
            })
            .optional()
    })
});

export type UserBookmarkCollectionDetailResponseHttp = z.infer<
    typeof UserBookmarkCollectionDetailResponseHttpSchema
>;

/**
 * Update response envelope for PATCH operations.
 */
export const UserBookmarkCollectionUpdateResponseHttpSchema =
    UserBookmarkCollectionSingleResponseHttpSchema;

export type UserBookmarkCollectionUpdateResponseHttp = UserBookmarkCollectionSingleResponseHttp;

/**
 * Delete response envelope for DELETE operations.
 */
export const UserBookmarkCollectionDeleteResponseHttpSchema = z.object({
    data: z.object({
        id: z.string().uuid(),
        deleted: z.literal(true)
    })
});

export type UserBookmarkCollectionDeleteResponseHttp = z.infer<
    typeof UserBookmarkCollectionDeleteResponseHttpSchema
>;

// ============================================================================
// ERROR RESPONSE SCHEMAS
// ============================================================================

/**
 * Error codes specific to user bookmark collection operations.
 */
export const UserBookmarkCollectionErrorCodeSchema = z.enum([
    'LIMIT_REACHED',
    'NAME_TAKEN',
    'NOT_FOUND',
    'FORBIDDEN'
]);

export type UserBookmarkCollectionErrorCode = z.infer<typeof UserBookmarkCollectionErrorCodeSchema>;

/**
 * 4xx error response schema for user bookmark collection endpoints.
 * Covers limit exceeded (user has too many collections), duplicate name,
 * not found, and access-denied scenarios.
 */
export const UserBookmarkCollectionErrorResponseHttpSchema = z.object({
    error: z.object({
        code: UserBookmarkCollectionErrorCodeSchema,
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional()
    })
});

export type UserBookmarkCollectionErrorResponseHttp = z.infer<
    typeof UserBookmarkCollectionErrorResponseHttpSchema
>;

// ============================================================================
// HTTP → DOMAIN CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert HTTP user bookmark collection search parameters to domain search schema.
 * Handles coercion from HTTP query strings to proper domain types.
 *
 * @param httpParams - Validated HTTP search parameters (post-coercion)
 * @returns Domain-compatible search input
 */
export const httpToDomainUserBookmarkCollectionSearch = (
    httpParams: UserBookmarkCollectionSearchHttp
): UserBookmarkCollectionSearchInput => {
    return {
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,
        userId: httpParams.userId,
        nameContains: httpParams.nameContains,
        hasBookmarks: httpParams.hasBookmarks ?? undefined,
        includeBookmarkCount: httpParams.includeBookmarkCount ?? false
    };
};

/**
 * Convert HTTP user bookmark collection create data to domain create input.
 *
 * @param httpData - Validated HTTP create body (post-coercion)
 * @returns Domain-compatible create input
 */
export const httpToDomainUserBookmarkCollectionCreate = (
    httpData: UserBookmarkCollectionCreateHttp
): UserBookmarkCollectionCreateInput => {
    return {
        userId: httpData.userId,
        name: httpData.name,
        description: httpData.description ?? null,
        color: httpData.color ?? null,
        icon: httpData.icon ?? null
    };
};

/**
 * Convert HTTP user bookmark collection update data to domain update input.
 * Only passes fields that were explicitly provided in the PATCH body.
 *
 * @param httpData - Validated HTTP update body (post-coercion)
 * @returns Domain-compatible update input
 */
export const httpToDomainUserBookmarkCollectionUpdate = (
    httpData: UserBookmarkCollectionUpdateHttp
): UserBookmarkCollectionUpdateInput => {
    return {
        ...(httpData.name !== undefined && { name: httpData.name }),
        ...(httpData.description !== undefined && { description: httpData.description }),
        ...(httpData.color !== undefined && { color: httpData.color }),
        ...(httpData.icon !== undefined && { icon: httpData.icon })
    };
};
