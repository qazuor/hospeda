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
