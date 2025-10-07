/**
 * Amenity HTTP Schemas
 *
 * HTTP-compatible schemas for amenity operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { AmenitiesTypeEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible amenity search schema with automatic coercion
 * Uses flat filter pattern for HTTP compatibility
 */
export const AmenitySearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters
    name: z.string().optional(),
    slug: z.string().optional(),
    category: z.string().optional(),
    icon: z.string().optional(),

    // Type filter
    type: AmenitiesTypeEnumSchema.optional(),

    // Boolean filters with HTTP coercion
    isActive: createBooleanQueryParam('Filter by amenity active status'),
    isPopular: createBooleanQueryParam('Filter popular amenities'),
    isFeatured: createBooleanQueryParam('Filter featured amenities'),
    hasIcon: createBooleanQueryParam('Filter amenities with icons'),
    hasDescription: createBooleanQueryParam('Filter amenities with descriptions'),

    // Numeric filters with HTTP coercion
    minPriority: z.coerce.number().int().min(0).max(100).optional(),
    maxPriority: z.coerce.number().int().min(0).max(100).optional(),
    minUsageCount: z.coerce.number().int().min(0).optional(),
    maxUsageCount: z.coerce.number().int().min(0).optional(),

    // Date filters with HTTP coercion
    createdAfter: z.coerce.date().optional(),
    createdBefore: z.coerce.date().optional(),
    updatedAfter: z.coerce.date().optional(),
    updatedBefore: z.coerce.date().optional(),

    // Text search filters
    nameContains: z.string().min(1).max(100).optional(),
    descriptionContains: z.string().min(1).max(500).optional(),

    // Array filters with HTTP coercion
    types: createArrayQueryParam('Filter by multiple amenity types'),
    categories: createArrayQueryParam('Filter by multiple categories')
});

export type AmenitySearchHttp = z.infer<typeof AmenitySearchHttpSchema>;

/**
 * HTTP-compatible amenity creation schema
 * Handles form data and JSON input for creating amenities via HTTP
 */
export const AmenityCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.amenity.name.required' }).max(100),
    slug: z.string().min(1, { message: 'zodError.amenity.slug.required' }).max(100),
    description: z.string().max(1000).optional(),
    type: AmenitiesTypeEnumSchema,
    category: z.string().min(1).max(50).optional(),
    icon: z.string().max(50).optional(),
    priority: z.coerce.number().int().min(0).max(100).default(50),
    isActive: z.coerce.boolean().default(true),
    isPopular: z.coerce.boolean().default(false),
    isFeatured: z.coerce.boolean().default(false)
});

export type AmenityCreateHttp = z.infer<typeof AmenityCreateHttpSchema>;

/**
 * HTTP-compatible amenity update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const AmenityUpdateHttpSchema = AmenityCreateHttpSchema.partial();

export type AmenityUpdateHttp = z.infer<typeof AmenityUpdateHttpSchema>;

/**
 * HTTP-compatible amenity query parameters for single amenity retrieval
 * Used for GET /amenities/:id type requests
 */
export const AmenityGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeUsageStats: createBooleanQueryParam('Include amenity usage statistics'),
    includeAccommodations: createBooleanQueryParam('Include related accommodations')
});

export type AmenityGetHttp = z.infer<typeof AmenityGetHttpSchema>;
