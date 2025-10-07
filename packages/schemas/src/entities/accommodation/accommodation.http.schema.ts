/**
 * Accommodation HTTP Schemas
 *
 * HTTP-compatible schemas for accommodation operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { PriceCurrencyEnum } from '../../enums/currency.enum.js';
import { AccommodationTypeEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible accommodation search schema with automatic coercion
 * Extracted from inline definition and enhanced with proper HTTP patterns
 */
export const AccommodationSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Location filters with HTTP coercion
    destinationId: z.string().uuid().optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().positive().optional(),

    // Price filters with HTTP coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),

    // Capacity filters with HTTP coercion
    minGuests: z.coerce.number().int().min(1).optional(),
    maxGuests: z.coerce.number().int().min(1).optional(),
    minBedrooms: z.coerce.number().int().min(0).optional(),
    maxBedrooms: z.coerce.number().int().min(0).optional(),
    minBathrooms: z.coerce.number().int().min(0).optional(),
    maxBathrooms: z.coerce.number().int().min(0).optional(),

    // Rating filters with HTTP coercion
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),

    // Boolean filters with HTTP coercion
    isFeatured: createBooleanQueryParam('Filter featured accommodations'),
    isAvailable: createBooleanQueryParam('Filter available accommodations'),
    hasPool: createBooleanQueryParam('Filter accommodations with pools'),
    hasWifi: createBooleanQueryParam('Filter accommodations with WiFi'),
    allowsPets: createBooleanQueryParam('Filter pet-friendly accommodations'),
    hasParking: createBooleanQueryParam('Filter accommodations with parking'),

    // Type filters
    type: AccommodationTypeEnumSchema.optional(),

    // Date filters with HTTP coercion
    checkIn: z.coerce.date().optional(),
    checkOut: z.coerce.date().optional(),
    availableFrom: z.coerce.date().optional(),
    availableTo: z.coerce.date().optional(),

    // Text search filters
    name: z.string().optional(),
    description: z.string().optional(),
    address: z.string().optional(),

    // Array filters with HTTP coercion
    types: createArrayQueryParam('Filter by multiple accommodation types'),
    amenities: createArrayQueryParam('Filter by required amenity IDs'),
    features: createArrayQueryParam('Filter by required feature IDs')
});

export type AccommodationSearchHttp = z.infer<typeof AccommodationSearchHttpSchema>;

/**
 * HTTP-compatible accommodation creation schema
 * Handles form data and JSON input for creating accommodations via HTTP
 */
export const AccommodationCreateHttpSchema = z.object({
    name: z.string().min(1, { message: 'zodError.accommodation.name.required' }).max(200),
    description: z.string().max(5000).optional(),
    type: AccommodationTypeEnumSchema,
    address: z.string().min(1, { message: 'zodError.accommodation.address.required' }).max(500),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),

    // Capacity
    maxGuests: z.coerce.number().int().min(1).max(20),
    bedrooms: z.coerce.number().int().min(0).max(10),
    bathrooms: z.coerce.number().int().min(1).max(10),

    // Pricing
    basePrice: z.coerce.number().min(0),
    currency: PriceCurrencyEnumSchema.default(PriceCurrencyEnum.USD),

    // Boolean properties
    isFeatured: z.coerce.boolean().default(false),
    isAvailable: z.coerce.boolean().default(true),
    allowsPets: z.coerce.boolean().default(false),

    // Relations
    destinationId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    hostId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
});

export type AccommodationCreateHttp = z.infer<typeof AccommodationCreateHttpSchema>;

/**
 * HTTP-compatible accommodation update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const AccommodationUpdateHttpSchema = AccommodationCreateHttpSchema.partial().omit({
    hostId: true // Host cannot be changed after creation
});

export type AccommodationUpdateHttp = z.infer<typeof AccommodationUpdateHttpSchema>;

/**
 * HTTP-compatible accommodation query parameters for single accommodation retrieval
 * Used for GET /accommodations/:id type requests
 */
export const AccommodationGetHttpSchema = z.object({
    id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    includeReviews: createBooleanQueryParam('Include accommodation reviews'),
    includeAmenities: createBooleanQueryParam('Include accommodation amenities'),
    includeFeatures: createBooleanQueryParam('Include accommodation features'),
    includeHost: createBooleanQueryParam('Include host information'),
    includeAvailability: createBooleanQueryParam('Include availability calendar')
});

export type AccommodationGetHttp = z.infer<typeof AccommodationGetHttpSchema>;
