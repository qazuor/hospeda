/**
 * Tag HTTP Schemas
 *
 * HTTP-compatible schemas for tag operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 *
 * Updated per SPEC-086 refactor (D-002, D-018):
 * - Removed `slug` (no public URL for user-tags)
 * - Replaced `notes` with `description`
 * - Added `type` filter
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { TagColorEnum } from '../../enums/tag-color.enum.js';
import { TagTypeEnum } from '../../enums/tag-type.enum.js';
import type { TagCreateInput, TagUpdateInput } from './tag.crud.schema.js';
import type { TagSearchInput } from './tag.query.schema.js';

/**
 * HTTP-compatible tag search schema with automatic coercion.
 * Uses FLAT filter pattern for HTTP compatibility.
 */
export const TagSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Type filter (D-002)
    type: z.nativeEnum(TagTypeEnum).optional(),

    // Owner filter
    ownerId: z.string().uuid().optional(),

    // Basic filters with HTTP coercion
    name: z.string().optional(),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),

    // Usage filters with HTTP coercion
    minUsageCount: z.coerce.number().int().min(0).optional(),
    maxUsageCount: z.coerce.number().int().min(0).optional(),
    isUnused: createBooleanQueryParam('Filter unused tags'),

    // Entity type filters with HTTP coercion
    usedInAccommodations: createBooleanQueryParam('Filter tags used in accommodations'),
    usedInDestinations: createBooleanQueryParam('Filter tags used in destinations'),
    usedInPosts: createBooleanQueryParam('Filter tags used in posts'),
    usedInEvents: createBooleanQueryParam('Filter tags used in events'),
    usedInUsers: createBooleanQueryParam('Filter tags used in users'),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    lastUsedAfter: z.coerce.date().optional(),
    lastUsedBefore: z.coerce.date().optional(),

    // Name pattern filters
    nameStartsWith: z.string().min(1).max(50).optional(),
    nameEndsWith: z.string().min(1).max(50).optional(),
    nameContains: z.string().min(1).max(50).optional(),

    // Length filters with HTTP coercion
    minNameLength: z.coerce.number().int().min(1).optional(),
    maxNameLength: z.coerce.number().int().min(1).optional(),

    // Search options with HTTP coercion
    fuzzySearch: createBooleanQueryParam('Enable fuzzy search for tag names')
});

export type TagSearchHttp = z.infer<typeof TagSearchHttpSchema>;

/**
 * HTTP-compatible tag creation schema.
 * Handles form data and JSON input for creating tags via HTTP.
 *
 * Note: `type` and `ownerId` must be supplied explicitly — there is no default
 * because the invariant (USER requires ownerId, SYSTEM/INTERNAL must not have it)
 * is enforced at the domain layer via TagCreateInputSchema.refine().
 */
export const TagCreateHttpSchema = z.object({
    type: z.nativeEnum(TagTypeEnum),
    ownerId: z.string().uuid().nullable().optional(),
    name: z.string().min(2).max(50),
    color: z.nativeEnum(TagColorEnum).optional(),
    description: z.string().nullable().optional(),
    icon: z.string().min(2).max(100).nullable().optional()
});

export type TagCreateHttp = z.infer<typeof TagCreateHttpSchema>;

/**
 * HTTP-compatible tag update schema.
 * Handles partial updates via HTTP PATCH requests.
 * `type` and `ownerId` are excluded — immutable after creation (D-018).
 */
export const TagUpdateHttpSchema = TagCreateHttpSchema.omit({
    type: true,
    ownerId: true
}).partial();

export type TagUpdateHttp = z.infer<typeof TagUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

/**
 * Convert HTTP tag search parameters to domain search schema.
 * Handles coercion from HTTP query strings to proper domain types.
 */
export const httpToDomainTagSearch = (httpParams: TagSearchHttp): TagSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Type filter
        type: httpParams.type,

        // Owner filter
        ownerId: httpParams.ownerId,

        // Basic filters
        name: httpParams.name,
        color: httpParams.color,

        // Usage filters
        minUsageCount: httpParams.minUsageCount,
        maxUsageCount: httpParams.maxUsageCount,
        isUnused: httpParams.isUnused,

        // Entity type usage filters
        usedInAccommodations: httpParams.usedInAccommodations,
        usedInDestinations: httpParams.usedInDestinations,
        usedInPosts: httpParams.usedInPosts,
        usedInEvents: httpParams.usedInEvents,
        usedInUsers: httpParams.usedInUsers,

        // Date filters
        createdAfter: httpParams.createdAfter,
        createdBefore: httpParams.createdBefore,
        lastUsedAfter: httpParams.lastUsedAfter,
        lastUsedBefore: httpParams.lastUsedBefore,

        // Name pattern filters
        nameStartsWith: httpParams.nameStartsWith,
        nameEndsWith: httpParams.nameEndsWith,
        nameContains: httpParams.nameContains,

        // Length filters
        minNameLength: httpParams.minNameLength,
        maxNameLength: httpParams.maxNameLength,

        // Search options
        fuzzySearch: httpParams.fuzzySearch
    };
};

/**
 * Convert HTTP tag create data to domain create input.
 * Handles form data conversion to proper domain types.
 * Sets default lifecycle state to ACTIVE.
 */
export const httpToDomainTagCreate = (httpData: TagCreateHttp): TagCreateInput => {
    return {
        type: httpData.type,
        ownerId: httpData.ownerId,
        name: httpData.name,
        color: httpData.color ?? TagColorEnum.BLUE,
        description: httpData.description,
        icon: httpData.icon,
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Convert HTTP tag update data to domain update input.
 * Handles partial updates from HTTP PATCH requests.
 */
export const httpToDomainTagUpdate = (httpData: TagUpdateHttp): TagUpdateInput => {
    return {
        name: httpData.name,
        color: httpData.color,
        description: httpData.description,
        icon: httpData.icon
    };
};
