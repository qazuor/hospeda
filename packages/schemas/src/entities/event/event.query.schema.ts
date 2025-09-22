import { z } from 'zod';
import { BaseSearchSchema, PaginationResultSchema } from '../../common/pagination.schema.js';
import { EventCategoryEnumSchema, PriceCurrencyEnumSchema } from '../../enums/index.js';
import { EventSchema } from './event.schema.js';

/**
 * Event Query Schemas
 *
 * Standardized query schemas for event operations following the unified pattern:
 * - BaseSearchSchema: Provides page/pageSize pagination, sortBy/sortOrder sorting, and 'q' search
 * - Entity-specific filters: Additional filtering options for events
 * - PaginationResultSchema: Unified response format with data array and pagination metadata
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Event-specific filters that extend the base search functionality
 */
export const EventFiltersSchema = z.object({
    // Basic filters
    category: EventCategoryEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    isVirtual: z.boolean().optional(),

    // Price filters
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    price: z.number().min(0).optional(),
    currency: PriceCurrencyEnumSchema.optional(),
    isFree: z.boolean().optional(),

    // Date filters
    startDateAfter: z.date().optional(),
    startDateBefore: z.date().optional(),
    endDateAfter: z.date().optional(),
    endDateBefore: z.date().optional(),

    // Location filters
    locationId: z.string().uuid().optional(),
    organizerId: z.string().uuid().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),

    // Capacity filters
    minCapacity: z.number().int().min(0).optional(),
    maxCapacity: z.number().int().min(0).optional(),
    hasCapacityLimit: z.boolean().optional(),

    // Status filters
    isPublished: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isCancelled: z.boolean().optional(),
    isPrivate: z.boolean().optional(),

    // Registration filters
    requiresRegistration: z.boolean().optional(),
    hasRegistrationFee: z.boolean().optional(),
    registrationOpen: z.boolean().optional(),

    // Content filters
    hasDescription: z.boolean().optional(),
    hasImages: z.boolean().optional(),
    hasVideo: z.boolean().optional(),

    // Author filters
    authorId: z.string().uuid().optional(),

    // Tag filters
    tags: z.array(z.string()).optional(),
    tag: z.string().optional()
});
export type EventFilters = z.infer<typeof EventFiltersSchema>;

// ============================================================================
// MAIN SEARCH SCHEMA
// ============================================================================

/**
 * Complete event search schema combining base search with event-specific filters
 *
 * Provides:
 * - page/pageSize: Standardized pagination
 * - sortBy/sortOrder: Sorting with 'asc'/'desc' values
 * - q: Text search query
 * - filters: Event-specific filtering options
 */
export const EventSearchSchema = BaseSearchSchema.extend({
    filters: EventFiltersSchema.optional()
});
export type EventSearchInput = z.infer<typeof EventSearchSchema>;

// ============================================================================
// SPECIALIZED QUERY SCHEMAS
// ============================================================================

/**
 * Schema for listing events by category
 */
export const EventsByCategorySchema = z.object({
    category: EventCategoryEnumSchema,
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    sortBy: z.enum(['startDate', 'createdAt', 'name', 'price']).default('startDate'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
    startDateAfter: z.date().optional(),
    isPublished: z.boolean().default(true)
});
export type EventsByCategoryInput = z.infer<typeof EventsByCategorySchema>;

/**
 * Schema for upcoming events
 */
export const UpcomingEventsSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(10),
    city: z.string().optional(),
    country: z.string().optional(),
    category: EventCategoryEnumSchema.optional(),
    maxPrice: z.number().min(0).optional(),
    daysAhead: z.number().int().min(1).max(365).default(30)
});
export type UpcomingEventsInput = z.infer<typeof UpcomingEventsSchema>;

/**
 * Schema for event statistics
 */
export const EventStatsSchema = z.object({
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    groupBy: z.enum(['day', 'week', 'month', 'year']).default('month'),
    category: EventCategoryEnumSchema.optional(),
    locationId: z.string().uuid().optional()
});
export type EventStatsInput = z.infer<typeof EventStatsSchema>;

// ============================================================================
// RESULT ITEM SCHEMAS
// ============================================================================

/**
 * Event list item schema - contains essential fields for list display
 */
export const EventListItemSchema = EventSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    description: true,
    category: true,
    date: true,
    pricing: true,
    isFeatured: true,
    media: true,
    locationId: true,
    organizerId: true,
    authorId: true,
    createdAt: true,
    updatedAt: true
});
export type EventListItem = z.infer<typeof EventListItemSchema>;

/**
 * Event search result item - extends list item with search relevance score
 */
export const EventSearchResultItemSchema = EventListItemSchema.extend({
    score: z.number().min(0).max(1).optional()
});
export type EventSearchResultItem = z.infer<typeof EventSearchResultItemSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Event list response using standardized pagination format
 */
export const EventListResponseSchema = PaginationResultSchema(EventListItemSchema);
export type EventListResponse = z.infer<typeof EventListResponseSchema>;

/**
 * Event search response using standardized pagination format with search results
 */
export const EventSearchResponseSchema = PaginationResultSchema(EventSearchResultItemSchema);
export type EventSearchResponse = z.infer<typeof EventSearchResponseSchema>;

// ============================================================================
// SUMMARY AND STATS SCHEMAS
// ============================================================================

/**
 * Event summary schema for quick display
 */
export const EventSummarySchema = EventSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    category: true,
    startDate: true,
    endDate: true,
    price: true,
    isFree: true,
    isVirtual: true,
    isPublished: true,
    createdAt: true
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

/**
 * Event statistics response schema
 */
export const EventStatsResponseSchema = z.object({
    totalEvents: z.number().int().min(0).default(0),
    publishedEvents: z.number().int().min(0).default(0),
    upcomingEvents: z.number().int().min(0).default(0),
    pastEvents: z.number().int().min(0).default(0),

    // Category distribution
    categoryDistribution: z.record(z.string(), z.number().int().min(0)).optional(),

    // Price analysis
    averagePrice: z.number().min(0).default(0),
    freeEvents: z.number().int().min(0).default(0),
    paidEvents: z.number().int().min(0).default(0),

    // Virtual vs physical
    virtualEvents: z.number().int().min(0).default(0),
    physicalEvents: z.number().int().min(0).default(0),

    // Activity by period
    eventsByPeriod: z
        .array(
            z.object({
                period: z.string(),
                eventCount: z.number().int().min(0),
                totalAttendees: z.number().int().min(0).optional()
            })
        )
        .optional(),

    // Top categories
    topCategories: z
        .array(
            z.object({
                category: z.string(),
                eventCount: z.number().int().min(0)
            })
        )
        .optional()
});
export type EventStatsResponse = z.infer<typeof EventStatsResponseSchema>;

// Compatibility aliases for existing code
export type EventListInput = EventSearchInput;
export type EventListOutput = EventListResponse;
export type EventSearchOutput = EventSearchResponse;
export type EventSearchResult = EventSearchResultItem;

// ============================================================================
// LEGACY COMPATIBILITY EXPORTS
// ============================================================================

// Legacy schema aliases for backward compatibility with .type.ts files
export const EventListInputSchema = EventSearchSchema;
export const EventListOutputSchema = EventListResponseSchema;
export const EventSearchInputSchema = EventSearchSchema;
export const EventSearchOutputSchema = EventSearchResponseSchema;
export const EventSearchResultSchema = EventSearchResponseSchema;

// Additional missing legacy exports
export const EventByAuthorInputSchema = z.object({
    authorId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    isPublished: z.boolean().optional()
});
export type EventByAuthorInput = z.infer<typeof EventByAuthorInputSchema>;

export const EventByOrganizerInputSchema = z.object({
    organizerId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    isPublished: z.boolean().optional()
});
export type EventByOrganizerInput = z.infer<typeof EventByOrganizerInputSchema>;

export const EventByCategoryInputSchema = EventsByCategorySchema;
export type EventByCategoryInput = z.infer<typeof EventByCategoryInputSchema>;
export const EventByLocationInputSchema = z.object({
    locationId: z.string().uuid().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20)
});
export type EventByLocationInput = z.infer<typeof EventByLocationInputSchema>;

export const EventFreeInputSchema = z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    city: z.string().optional(),
    category: EventCategoryEnumSchema.optional(),
    startDateAfter: z.date().optional()
});
export type EventFreeInput = z.infer<typeof EventFreeInputSchema>;

export const EventUpcomingInputSchema = UpcomingEventsSchema;
export type EventUpcomingInput = z.infer<typeof EventUpcomingInputSchema>;

export const EventSummaryInputSchema = z.object({
    eventId: z.string().uuid()
});

export const EventSummaryOutputSchema = EventSummarySchema;
export type EventSummaryInput = z.infer<typeof EventSummaryInputSchema>;
export type EventSummaryOutput = z.infer<typeof EventSummaryOutputSchema>;
