/**
 * Destination HTTP Schemas
 *
 * HTTP-compatible schemas for destination operations with automatic query string coercion.
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
 * HTTP-compatible destination search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const DestinationSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    isFeatured: createBooleanQueryParam('Filter featured destinations'),

    // Location filters with HTTP coercion
    country: z.string().length(2).optional(),
    state: z.string().min(1).max(100).optional(),
    city: z.string().min(1).max(100).optional(),

    // Geographic radius search with HTTP coercion
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().min(0).max(1000).optional(),

    // Accommodation metrics with HTTP coercion
    minAccommodations: z.coerce.number().int().min(0).optional(),
    maxAccommodations: z.coerce.number().int().min(0).optional(),

    // Rating filter with HTTP coercion
    minRating: z.coerce.number().min(0).max(5).optional(),

    // Features with HTTP coercion
    hasAttractions: createBooleanQueryParam('Filter destinations with attractions'),
    climate: z.string().min(1).max(50).optional(),
    bestSeason: z.string().min(1).max(50).optional(),

    // Array filters with HTTP coercion
    tags: createArrayQueryParam('Filter by tag UUIDs')
});

export type DestinationSearchHttp = z.infer<typeof DestinationSearchHttpSchema>;

/**
 * HTTP-compatible destination creation schema
 * Handles form data and JSON input for creating destinations via HTTP
 */
export const DestinationCreateHttpSchema = z.object({
    name: z.string().min(3).max(100),
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    summary: z.string().min(10).max(300),
    description: z.string().min(50).max(2000),
    country: z.string().length(2),
    state: z.string().min(1).max(100).optional(),
    city: z.string().min(1).max(100).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    isFeatured: z.coerce.boolean().default(false),
    climate: z.string().min(1).max(50).optional(),
    bestSeason: z.string().min(1).max(50).optional()
});

export type DestinationCreateHttp = z.infer<typeof DestinationCreateHttpSchema>;

/**
 * HTTP-compatible destination update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const DestinationUpdateHttpSchema = DestinationCreateHttpSchema.partial();

export type DestinationUpdateHttp = z.infer<typeof DestinationUpdateHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';
import type { DestinationCreateInput, DestinationUpdateInput } from './destination.crud.schema.js';
import type { DestinationSearchInput } from './destination.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainDestinationSearch = (
    httpParams: DestinationSearchHttp
): DestinationSearchInput => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // Destination-specific filters that exist in both HTTP and domain schemas
    isFeatured: httpParams.isFeatured,
    country: httpParams.country,
    state: httpParams.state,
    city: httpParams.city,
    latitude: httpParams.latitude,
    longitude: httpParams.longitude,
    radius: httpParams.radius,
    minAccommodations: httpParams.minAccommodations,
    maxAccommodations: httpParams.maxAccommodations,
    minRating: httpParams.minRating,
    tags: httpParams.tags

    // Note: hasAttractions, climate, bestSeason exist in HTTP schema but
    // may not exist in domain search schema - these are handled by the service layer
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields
 */
export const httpToDomainDestinationCreate = (
    httpData: DestinationCreateHttp
): DestinationCreateInput => ({
    // Basic destination fields that exist in domain schema
    name: httpData.name,
    slug:
        httpData.slug ||
        httpData.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
    summary: httpData.summary,
    description: httpData.description,
    isFeatured: httpData.isFeatured,

    // Location data mapped to BaseLocationFields structure
    ...(httpData.country && {
        location: {
            country: httpData.country,
            state: httpData.state || 'Unknown',
            zipCode: '00000', // Required field, provide default
            ...(httpData.latitude &&
                httpData.longitude && {
                    coordinates: {
                        lat: httpData.latitude.toString(),
                        long: httpData.longitude.toString()
                    }
                })
        }
    }),

    // Required fields with defaults for domain schema
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING,
    accommodationsCount: 0, // Start with 0 accommodations
    reviewsCount: 0, // Start with 0 reviews
    averageRating: 0 // Start with 0 rating

    // Note: Fields like climate, bestSeason from HTTP schema don't exist
    // in the domain schema and should be handled by service layer extensions
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainDestinationUpdate = (
    httpData: DestinationUpdateHttp
): DestinationUpdateInput => ({
    // Map only basic updateable fields that exist in domain schema
    name: httpData.name,
    slug: httpData.slug,
    summary: httpData.summary,
    description: httpData.description,
    isFeatured: httpData.isFeatured

    // Note: Location updates are complex due to nested structure and required fields
    // The service layer should handle merging location data properly
    // Note: climate, bestSeason fields don't exist in domain schema
});
