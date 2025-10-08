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

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import type { AmenityCreateInput, AmenityUpdateInput } from './amenity.crud.schema.js';
import type { AmenitySearchInput } from './amenity.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainAmenitySearch = (httpParams: AmenitySearchHttp): AmenitySearchInput => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // Amenity-specific filters that exist in BOTH HTTP and domain schemas
    name: httpParams.name,
    slug: httpParams.slug,
    category: httpParams.category,
    icon: httpParams.icon,
    hasIcon: httpParams.hasIcon,
    hasDescription: httpParams.hasDescription,
    minUsageCount: httpParams.minUsageCount,
    maxUsageCount: httpParams.maxUsageCount,
    createdAfter: httpParams.createdAfter,
    createdBefore: httpParams.createdBefore

    // Note: Many HTTP search fields like isActive, isPopular, isFeatured, etc.
    // don't exist in the domain search schema - these are filtered at service layer
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields
 */
export const httpToDomainAmenityCreate = (httpData: AmenityCreateHttp): AmenityCreateInput => ({
    // Basic amenity fields that exist in domain schema
    name: httpData.name,
    slug: httpData.slug,
    description: httpData.description,
    type: httpData.type,
    icon: httpData.icon,
    isFeatured: httpData.isFeatured,
    isBuiltin: false, // Default for user-created amenities

    // Required fields with defaults for domain schema
    lifecycleState: LifecycleStatusEnum.ACTIVE

    // Note: category, priority, isActive, isPopular from HTTP schema
    // don't exist in domain schema - these are handled at service layer
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainAmenityUpdate = (httpData: AmenityUpdateHttp): AmenityUpdateInput => ({
    // Map only fields that exist in domain schema
    name: httpData.name,
    slug: httpData.slug,
    description: httpData.description,
    type: httpData.type,
    icon: httpData.icon,
    isFeatured: httpData.isFeatured,
    isBuiltin: httpData.isActive !== undefined ? !httpData.isActive : undefined // Map isActive inversely to isBuiltin
});
