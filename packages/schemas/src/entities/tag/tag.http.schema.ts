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
