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
 * HTTP-compatible schema for events by author
 * Specific schema for events by author endpoint
 */
export const EventByAuthorHttpSchema = BaseHttpSearchSchema.extend({
    // Standard pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Search query
    q: z.string().optional(),

    // Event-specific filters
    category: EventCategoryEnumSchema.optional(),
    isFeatured: createBooleanQueryParam('Filter featured events'),
    isVirtual: createBooleanQueryParam('Filter virtual events')
});

export type EventByAuthorHttp = z.infer<typeof EventByAuthorHttpSchema>;

/**
 * HTTP-compatible schema for events by location
 * Specific schema for events by location endpoint
 */
export const EventByLocationHttpSchema = BaseHttpSearchSchema.extend({
    // Standard pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Search query
    q: z.string().optional(),

    // Event-specific filters
    category: EventCategoryEnumSchema.optional(),
    isFeatured: createBooleanQueryParam('Filter featured events'),
    isVirtual: createBooleanQueryParam('Filter virtual events')
});

export type EventByLocationHttp = z.infer<typeof EventByLocationHttpSchema>;

/**
 * HTTP-compatible schema for upcoming events
 * Specific schema for upcoming events endpoint
 */
export const EventUpcomingHttpSchema = BaseHttpSearchSchema.extend({
    // Standard pagination
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    // Sorting
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),

    // Search query
    q: z.string().optional(),

    // Upcoming-specific filters
    daysAhead: z.coerce.number().int().min(1).max(365).default(30),
    category: EventCategoryEnumSchema.optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    isFree: createBooleanQueryParam('Filter free events'),
    isVirtual: createBooleanQueryParam('Filter virtual events')
});

export type EventUpcomingHttp = z.infer<typeof EventUpcomingHttpSchema>;

/**
 * HTTP-compatible event creation schema
 * Handles form data and JSON input for creating events via HTTP
 */
export const EventCreateHttpSchema = z.object({
    name: z.string().min(5).max(200), // Changed from 'title' to 'name' for consistency with domain
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

// ============================================================================
// HTTP TO DOMAIN CONVERSION FUNCTIONS
// ============================================================================

import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { ModerationStatusEnum } from '../../enums/moderation-status.enum.js';
import { VisibilityEnum } from '../../enums/visibility.enum.js';
import type { EventCreateInput, EventUpdateInput } from './event.crud.schema.js';
import type { EventSearchInput } from './event.query.schema.js';

/**
 * Convert HTTP search parameters to domain search object
 * Maps HTTP query parameters to properly typed domain search fields
 */
export const httpToDomainEventSearch = (httpParams: EventSearchHttp): EventSearchInput => ({
    // Base pagination and sorting
    page: httpParams.page,
    pageSize: httpParams.pageSize,
    sortBy: httpParams.sortBy,
    sortOrder: httpParams.sortOrder,
    q: httpParams.q,

    // Event-specific filters that exist in both HTTP and domain schemas
    category: httpParams.category,
    isFeatured: httpParams.isFeatured,
    isVirtual: httpParams.isVirtual,
    minPrice: httpParams.minPrice,
    maxPrice: httpParams.maxPrice,
    price: httpParams.price,
    currency: httpParams.currency,
    isFree: httpParams.isFree,
    startDateAfter: httpParams.startDateAfter,
    startDateBefore: httpParams.startDateBefore,
    endDateAfter: httpParams.endDateAfter,
    endDateBefore: httpParams.endDateBefore,
    locationId: httpParams.locationId,
    organizerId: httpParams.organizerId,
    city: httpParams.city,
    state: httpParams.state,
    country: httpParams.country,
    minCapacity: httpParams.minCapacity,
    maxCapacity: httpParams.maxCapacity,
    hasCapacityLimit: httpParams.hasCapacityLimit,
    isPublished: httpParams.isPublished,
    isActive: httpParams.isActive,
    isCancelled: httpParams.isCancelled,
    isPrivate: httpParams.isPrivate,
    requiresRegistration: httpParams.requiresRegistration,
    hasRegistrationFee: httpParams.hasRegistrationFee,
    registrationOpen: httpParams.registrationOpen,
    hasDescription: httpParams.hasDescription,
    hasImages: httpParams.hasImages,
    hasVideo: httpParams.hasVideo,
    authorId: httpParams.authorId,
    tag: httpParams.tag,
    tags: httpParams.tags
});

/**
 * Convert HTTP create data to domain create input
 * Maps HTTP form/JSON data to domain object with required fields
 */
export const httpToDomainEventCreate = (httpData: EventCreateHttp): EventCreateInput => ({
    // Direct field mapping - no conversion needed now that HTTP uses 'name'
    name: httpData.name,
    slug:
        httpData.slug ||
        httpData.name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, ''),
    summary: httpData.description.substring(0, 300), // Generate summary from description
    description: httpData.description,
    category: httpData.category,

    // Map HTTP dates to domain date object
    date: {
        start: httpData.startDate,
        end: httpData.endDate
    },

    // Map HTTP pricing to domain pricing object
    ...(httpData.price !== undefined && {
        pricing: {
            price: httpData.price,
            currency: httpData.currency,
            isFree: httpData.price === 0
        }
    }),

    locationId: httpData.locationId,
    organizerId: httpData.organizerId,
    authorId: httpData.authorId,
    isFeatured: httpData.isFeatured,

    // Required fields with defaults for domain schema
    lifecycleState: LifecycleStatusEnum.ACTIVE,
    visibility: VisibilityEnum.PUBLIC,
    moderationState: ModerationStatusEnum.PENDING
});

/**
 * Convert HTTP update data to domain update input
 * Maps HTTP PATCH data to domain object (all fields optional for updates)
 */
export const httpToDomainEventUpdate = (httpData: EventUpdateHttp): EventUpdateInput => ({
    // Direct field mapping - no conversion needed now that HTTP uses 'name'
    name: httpData.name,
    slug: httpData.slug,
    summary: httpData.description?.substring(0, 300),
    description: httpData.description,
    category: httpData.category,

    // Map HTTP dates to domain date object (if provided)
    ...(httpData.startDate && {
        date: {
            start: httpData.startDate,
            ...(httpData.endDate && { end: httpData.endDate })
        }
    }),

    locationId: httpData.locationId,
    organizerId: httpData.organizerId,
    authorId: httpData.authorId,
    isFeatured: httpData.isFeatured

    // Note: Pricing updates are complex due to nested structure
    // The service layer should handle merging pricing data properly
});
