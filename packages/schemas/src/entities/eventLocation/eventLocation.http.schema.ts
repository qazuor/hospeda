/**
 * Event Location HTTP Schemas
 *
 * HTTP-compatible schemas for event location operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';

/**
 * HTTP-compatible event location search schema with automatic coercion
 * Extends base search with location-specific filters
 */
export const EventLocationSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),
    street: z.string().optional(),
    placeName: z.string().optional(),

    // Destination FK filter (SPEC-095): geographic context lives on the destination relation.
    destinationId: z.string().uuid().optional(),

    // Geographic filters with HTTP coercion
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),

    // Capacity filters with HTTP coercion
    minCapacity: z.coerce.number().int().min(1).optional(),
    maxCapacity: z.coerce.number().int().min(1).optional(),

    // Boolean filters with HTTP coercion
    hasWifi: createBooleanQueryParam('Filter locations with WiFi'),
    hasParking: createBooleanQueryParam('Filter locations with parking'),
    hasAirConditioning: createBooleanQueryParam('Filter locations with air conditioning'),
    isAccessible: createBooleanQueryParam('Filter wheelchair accessible locations'),
    hasAudioVisual: createBooleanQueryParam('Filter locations with A/V equipment'),
    hasCatering: createBooleanQueryParam('Filter locations with catering services'),

    // Array filters
    destinationIds: createArrayQueryParam('Filter by multiple destination IDs'),
    venueTypes: createArrayQueryParam('Filter by venue types')
});

export type EventLocationSearchHttp = z.infer<typeof EventLocationSearchHttpSchema>;

/**
 * HTTP-compatible event location creation schema
 * Handles form data and JSON input for creating locations via HTTP
 */
export const EventLocationCreateHttpSchema = z.object({
    name: z.string().min(3).max(100),
    slug: z
        .string()
        .min(2)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(), // Auto-generated from name if not provided
    description: z.string().min(10).max(500).optional(),

    // Destination FK (SPEC-095): geographic context lives on the destination relation.
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),

    // Postal address information
    placeName: z.string().min(2).max(100).optional(),
    street: z.string().min(2).max(50).optional(),
    number: z.string().min(1).max(10).optional(),
    floor: z.string().max(10).optional(),

    // Geographic coordinates
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),

    // Venue details
    capacity: z.coerce.number().int().min(1).optional(),
    venueType: z.string().max(50).optional(),

    // Amenities
    hasWifi: z.coerce.boolean().default(false),
    hasParking: z.coerce.boolean().default(false),
    hasAirConditioning: z.coerce.boolean().default(false),
    isAccessible: z.coerce.boolean().default(false),
    hasAudioVisual: z.coerce.boolean().default(false),
    hasCatering: z.coerce.boolean().default(false)
});

export type EventLocationCreateHttp = z.infer<typeof EventLocationCreateHttpSchema>;

/**
 * HTTP-compatible event location update schema
 * Handles partial updates via HTTP PATCH requests
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const EventLocationUpdateHttpSchema = z
    .object(stripShapeDefaults(EventLocationCreateHttpSchema.shape))
    .partial();

export type EventLocationUpdateHttp = z.infer<typeof EventLocationUpdateHttpSchema>;

/**
 * HTTP-compatible event location query parameters for single location retrieval
 * Used for GET /event-locations/:id type requests
 */
export const EventLocationGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeEvents: createBooleanQueryParam('Include events at this location'),
    includeStats: createBooleanQueryParam('Include location usage statistics'),
    includeAmenities: createBooleanQueryParam('Include detailed amenity information')
});

export type EventLocationGetHttp = z.infer<typeof EventLocationGetHttpSchema>;

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import type { EventLocationSearchInput } from './eventLocation.query.schema.js';

import type {
    EventLocationCreateInput,
    EventLocationUpdateInput
} from './eventLocation.crud.schema.js';

/**
 * Convert HTTP event location search parameters to domain search schema
 * Handles coercion from HTTP query strings to proper domain types
 */
export const httpToDomainEventLocationSearch = (
    httpParams: EventLocationSearchHttp
): EventLocationSearchInput => {
    return {
        // Base search fields
        page: httpParams.page,
        pageSize: httpParams.pageSize,
        sortBy: httpParams.sortBy,
        sortOrder: httpParams.sortOrder,
        q: httpParams.q,

        // Text search filters (only available fields)
        name: httpParams.name,
        destinationId: httpParams.destinationId,

        // Geographic filters
        latitude: httpParams.latitude,
        longitude: httpParams.longitude,
        radius: httpParams.radius,

        // Capacity filters
        minCapacity: httpParams.minCapacity,
        maxCapacity: httpParams.maxCapacity,

        // Boolean filters (only available fields)
        hasParking: httpParams.hasParking,
        isAccessible: httpParams.isAccessible

        // Note: many HTTP fields like description, hasWifi, hasAirConditioning, etc.
        // are not available in domain search schema
    };
};

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';

/**
 * Generate a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns A lowercase slug with hyphens
 */
const generateSlug = (text: string): string => {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};

/**
 * Convert HTTP event location create data to domain create input
 * Handles form data conversion to proper domain types
 * Sets default lifecycle state to ACTIVE and handles required fields
 */
export const httpToDomainEventLocationCreate = (
    httpData: EventLocationCreateHttp
): EventLocationCreateInput => {
    return {
        // Required fields
        slug: httpData.slug || generateSlug(httpData.name),

        // Destination FK — geographic context lives in the destination relation (SPEC-095).
        destinationId: httpData.destinationId,

        // Postal address fields
        street: httpData.street,
        number: httpData.number,
        floor: httpData.floor,
        apartment: undefined, // Not in HTTP schema but in domain
        placeName: httpData.placeName,

        // Coordinates
        coordinates:
            httpData.latitude && httpData.longitude
                ? {
                      lat: httpData.latitude.toString(),
                      long: httpData.longitude.toString()
                  }
                : undefined,

        // Lifecycle state
        lifecycleState: LifecycleStatusEnum.ACTIVE

        // Note: capacity, venueType, and amenity fields from HTTP schema
        // are not available in domain schema structure
    };
};

/**
 * Convert HTTP event location update data to domain update input
 * Handles partial updates from HTTP PATCH requests
 */
export const httpToDomainEventLocationUpdate = (
    httpData: EventLocationUpdateHttp
): EventLocationUpdateInput => {
    return {
        // Optional fields that can be updated
        destinationId: httpData.destinationId,
        street: httpData.street,
        number: httpData.number,
        floor: httpData.floor,
        placeName: httpData.placeName,

        // Coordinates
        coordinates:
            httpData.latitude && httpData.longitude
                ? {
                      lat: httpData.latitude.toString(),
                      long: httpData.longitude.toString()
                  }
                : undefined

        // Note: many HTTP amenity fields are not available in domain schema
    };
};
