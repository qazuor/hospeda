/**
 * Event HTTP Schemas
 *
 * HTTP-compatible schemas for event operations with automatic query string coercion.
 * These schemas handle the conversion from HTTP query parameters (strings) to properly
 * typed objects for the domain layer.
 */
import { z } from 'zod';
import {
    BaseHttpSearchSchema,
    createArrayQueryParam,
    createBooleanQueryParam
} from '../../api/http/base-http.schema.js';
import { EventCategoryEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';

/**
 * HTTP-compatible event search schema with automatic coercion
 * Uses FLAT filter pattern for HTTP compatibility
 */
export const EventSearchHttpSchema = BaseHttpSearchSchema.extend({
    // Basic filters with HTTP coercion
    category: EventCategoryEnumSchema.optional(),
    isFeatured: createBooleanQueryParam('Filter featured events'),
    isVirtual: createBooleanQueryParam('Filter virtual events'),

    // Price filters with HTTP coercion
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    price: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    isFree: createBooleanQueryParam('Filter free events'),

    // Date filters with HTTP coercion
    startDateAfter: z.coerce.date().optional(),
    startDateBefore: z.coerce.date().optional(),
    endDateAfter: z.coerce.date().optional(),
    endDateBefore: z.coerce.date().optional(),

    // Location filters
    locationId: z.string().uuid().optional(),
    organizerId: z.string().uuid().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),

    // Capacity filters with HTTP coercion
    minCapacity: z.coerce.number().int().min(0).optional(),
    maxCapacity: z.coerce.number().int().min(0).optional(),
    hasCapacityLimit: createBooleanQueryParam('Filter events with capacity limits'),

    // Status filters with HTTP coercion
    isPublished: createBooleanQueryParam('Filter published events'),
    isActive: createBooleanQueryParam('Filter active events'),
    isCancelled: createBooleanQueryParam('Filter cancelled events'),
    isPrivate: createBooleanQueryParam('Filter private events'),

    // Registration filters with HTTP coercion
    requiresRegistration: createBooleanQueryParam('Filter events requiring registration'),
    hasRegistrationFee: createBooleanQueryParam('Filter events with registration fees'),
    registrationOpen: createBooleanQueryParam('Filter events with open registration'),

    // Content filters with HTTP coercion
    hasDescription: createBooleanQueryParam('Filter events with descriptions'),
    hasImages: createBooleanQueryParam('Filter events with images'),
    hasVideo: createBooleanQueryParam('Filter events with video'),

    // Author filters
    authorId: z.string().uuid().optional(),

    // Tag filters with HTTP coercion
    tag: z.string().optional(),
    tags: createArrayQueryParam('Filter by tag names')
});

export type EventSearchHttp = z.infer<typeof EventSearchHttpSchema>;

/**
 * HTTP-compatible event creation schema
 * Handles form data and JSON input for creating events via HTTP
 */
export const EventCreateHttpSchema = z.object({
    title: z.string().min(5).max(200),
    slug: z
        .string()
        .min(5)
        .max(200)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    description: z.string().min(50).max(2000),
    category: EventCategoryEnumSchema,
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    locationId: z.string().uuid().optional(),
    organizerId: z.string().uuid(),
    authorId: z.string().uuid(),
    isFeatured: z.coerce.boolean().default(false),
    isVirtual: z.coerce.boolean().default(false),
    isPrivate: z.coerce.boolean().default(false),
    requiresRegistration: z.coerce.boolean().default(false),
    capacity: z.coerce.number().int().min(1).optional(),
    price: z.coerce.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    registrationUrl: z.string().url().optional()
});

export type EventCreateHttp = z.infer<typeof EventCreateHttpSchema>;

/**
 * HTTP-compatible event update schema
 * Handles partial updates via HTTP PATCH requests
 */
export const EventUpdateHttpSchema = EventCreateHttpSchema.partial();

export type EventUpdateHttp = z.infer<typeof EventUpdateHttpSchema>;
