/**
 * Tag HTTP Schemas
 *
 * HTTP-compatible schemas for tag operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import { BaseHttpSearchSchema, createBooleanQueryParam } from '../../api/http/base-http.schema.js';

/**
 * HTTP-compatible tag search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const TagSearchHttpSchema = BaseHttpSearchSchema.extend({
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
 * HTTP-compatible tag creation schema
 * Handles form data and JSON input for creating tags via HTTP
 */
export const TagCreateHttpSchema = z.object({
    name: z.string().min(1).max(50),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    description: z.string().max(200).optional(),
    isSystem: z.coerce.boolean().default(false)
});

export type TagCreateHttp = z.infer<typeof TagCreateHttpSchema>;

/**
 * HTTP-compatible tag update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const TagUpdateHttpSchema = TagCreateHttpSchema.partial();

export type TagUpdateHttp = z.infer<typeof TagUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { TagSearchInput } from './tag.query.schema.js';

import type { TagCreateInput, TagUpdateInput } from './tag.crud.schema.js';

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { TagColorEnum } from '../../enums/tag-color.enum.js';

/**
 * Convert HTTP tag search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainTagSearch = (httpParams: TagSearchHttp): TagSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

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
 * Convert HTTP tag create data to domain create input
 * Handles form data conversion to proper domain types
 * Sets default lifecycle state to ACTIVE
 * Note: HTTP color (hex) is mapped to enum color
 * Note: HTTP description is mapped to domain notes field
 * Note: isSystem field from HTTP not available in domain schema
 */
export const httpToDomainTagCreate = (httpData: TagCreateHttp): TagCreateInput => {
    return {
        name: httpData.name,
        slug: httpData.name.toLowerCase().replace(/\s+/g, '-'), // Generate slug from name
        color: TagColorEnum.BLUE, // Default color since HTTP hex doesn't map directly to enum
        notes: httpData.description, // Map description to notes
        lifecycleState: LifecycleStatusEnum.ACTIVE
    };
};

/**
 * Convert HTTP tag update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 * Note: HTTP color (hex) is mapped to enum color
 * Note: HTTP description is mapped to domain notes field
 * Note: isSystem field from HTTP not available in domain schema
 */
export const httpToDomainTagUpdate = (httpData: TagUpdateHttp): TagUpdateInput => {
    return {
        name: httpData.name,
        slug: httpData.name ? httpData.name.toLowerCase().replace(/\s+/g, '-') : undefined,
        color: httpData.color ? TagColorEnum.BLUE : undefined, // Default color if provided
        notes: httpData.description // Map description to notes
    };
};
