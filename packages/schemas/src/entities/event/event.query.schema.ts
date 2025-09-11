import { z } from 'zod';
import { BaseSearchSchema, PaginationSchema } from '../../common/search.schemas.js';
import { EventCategoryEnumSchema, LifecycleStatusEnumSchema } from '../../enums/index.js';
import { EventSchema } from './event.schema.js';

/**
 * Event Query Schemas
 *
 * This file contains all schemas related to querying events:
 * - List (input/output/item)
 * - Search (input/output/result)
 * - Summary
 * - Stats
 * - Filters
 */

// ============================================================================
// FILTER SCHEMAS
// ============================================================================

/**
 * Schema for event-specific filters
 * Used in list and search operations
 */
export const EventFiltersSchema = z.object({
    // Basic filters
    status: LifecycleStatusEnumSchema.optional(),
    category: EventCategoryEnumSchema.optional(),
    isFeatured: z
        .boolean({
            message: 'zodError.event.filters.isFeatured.invalidType'
        })
        .optional(),

    isPublished: z
        .boolean({
            message: 'zodError.event.filters.isPublished.invalidType'
        })
        .optional(),

    isRecurring: z
        .boolean({
            message: 'zodError.event.filters.isRecurring.invalidType'
        })
        .optional(),

    isCancelled: z
        .boolean({
            message: 'zodError.event.filters.isCancelled.invalidType'
        })
        .optional(),

    // Date filters
    startDateAfter: z
        .date({
            message: 'zodError.event.filters.startDateAfter.invalidType'
        })
        .optional(),

    startDateBefore: z
        .date({
            message: 'zodError.event.filters.startDateBefore.invalidType'
        })
        .optional(),

    endDateAfter: z
        .date({
            message: 'zodError.event.filters.endDateAfter.invalidType'
        })
        .optional(),

    endDateBefore: z
        .date({
            message: 'zodError.event.filters.endDateBefore.invalidType'
        })
        .optional(),

    // Time period filters
    isUpcoming: z
        .boolean({
            message: 'zodError.event.filters.isUpcoming.invalidType'
        })
        .optional(),

    isPast: z
        .boolean({
            message: 'zodError.event.filters.isPast.invalidType'
        })
        .optional(),

    isOngoing: z
        .boolean({
            message: 'zodError.event.filters.isOngoing.invalidType'
        })
        .optional(),

    // Duration filters
    minDurationHours: z
        .number({
            message: 'zodError.event.filters.minDurationHours.invalidType'
        })
        .min(0, { message: 'zodError.event.filters.minDurationHours.min' })
        .optional(),

    maxDurationHours: z
        .number({
            message: 'zodError.event.filters.maxDurationHours.invalidType'
        })
        .min(0, { message: 'zodError.event.filters.maxDurationHours.min' })
        .optional(),

    // Location filters
    destinationId: z
        .string({
            message: 'zodError.event.filters.destinationId.invalidType'
        })
        .uuid({ message: 'zodError.event.filters.destinationId.uuid' })
        .optional(),

    venue: z
        .string({
            message: 'zodError.event.filters.venue.invalidType'
        })
        .min(1, { message: 'zodError.event.filters.venue.min' })
        .max(200, { message: 'zodError.event.filters.venue.max' })
        .optional(),

    // Location radius search
    latitude: z
        .number({
            message: 'zodError.event.filters.latitude.invalidType'
        })
        .min(-90, { message: 'zodError.event.filters.latitude.min' })
        .max(90, { message: 'zodError.event.filters.latitude.max' })
        .optional(),

    longitude: z
        .number({
            message: 'zodError.event.filters.longitude.invalidType'
        })
        .min(-180, { message: 'zodError.event.filters.longitude.min' })
        .max(180, { message: 'zodError.event.filters.longitude.max' })
        .optional(),

    radius: z
        .number({
            message: 'zodError.event.filters.radius.invalidType'
        })
        .min(0, { message: 'zodError.event.filters.radius.min' })
        .max(1000, { message: 'zodError.event.filters.radius.max' })
        .optional(),

    // Organizer filters
    organizerId: z
        .string({
            message: 'zodError.event.filters.organizerId.invalidType'
        })
        .uuid({ message: 'zodError.event.filters.organizerId.uuid' })
        .optional(),

    // Capacity filters
    minCapacity: z
        .number({
            message: 'zodError.event.filters.minCapacity.invalidType'
        })
        .int({ message: 'zodError.event.filters.minCapacity.int' })
        .min(1, { message: 'zodError.event.filters.minCapacity.min' })
        .optional(),

    maxCapacity: z
        .number({
            message: 'zodError.event.filters.maxCapacity.invalidType'
        })
        .int({ message: 'zodError.event.filters.maxCapacity.int' })
        .min(1, { message: 'zodError.event.filters.maxCapacity.min' })
        .optional(),

    // Price filters
    isFree: z
        .boolean({
            message: 'zodError.event.filters.isFree.invalidType'
        })
        .optional(),

    minPrice: z
        .number({
            message: 'zodError.event.filters.minPrice.invalidType'
        })
        .min(0, { message: 'zodError.event.filters.minPrice.min' })
        .optional(),

    maxPrice: z
        .number({
            message: 'zodError.event.filters.maxPrice.invalidType'
        })
        .min(0, { message: 'zodError.event.filters.maxPrice.min' })
        .optional(),

    // Tags filter
    tags: z.array(z.string().uuid({ message: 'zodError.event.filters.tags.item.uuid' })).optional(),

    // Age restrictions
    minAge: z
        .number({
            message: 'zodError.event.filters.minAge.invalidType'
        })
        .int({ message: 'zodError.event.filters.minAge.int' })
        .min(0, { message: 'zodError.event.filters.minAge.min' })
        .max(120, { message: 'zodError.event.filters.minAge.max' })
        .optional(),

    maxAge: z
        .number({
            message: 'zodError.event.filters.maxAge.invalidType'
        })
        .int({ message: 'zodError.event.filters.maxAge.int' })
        .min(0, { message: 'zodError.event.filters.maxAge.min' })
        .max(120, { message: 'zodError.event.filters.maxAge.max' })
        .optional()
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for event list input parameters
 * Includes pagination and filters
 */
export const EventListInputSchema = PaginationSchema.extend({
    filters: EventFiltersSchema.optional()
});

/**
 * Schema for individual event items in lists
 * Contains essential fields for list display
 */
export const EventListItemSchema = EventSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    category: true,
    status: true,
    isFeatured: true,
    isRecurring: true,
    startDate: true,
    endDate: true,
    location: true,
    media: true,
    capacity: true,
    attendeesCount: true,
    price: true,
    organizerId: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for event list output
 * Uses generic paginated response with list items
 */
export const EventListOutputSchema = z.object({
    items: z.array(EventListItemSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    })
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for event search input parameters
 * Extends base search with event-specific filters
 */
export const EventSearchInputSchema = BaseSearchSchema.extend({
    filters: EventFiltersSchema.optional(),
    query: z
        .string({
            message: 'zodError.event.search.query.invalidType'
        })
        .min(1, { message: 'zodError.event.search.query.min' })
        .max(100, { message: 'zodError.event.search.query.max' })
        .optional()
});

/**
 * Schema for individual event search results
 * Extends list item with search score
 */
export const EventSearchResultSchema = EventListItemSchema.extend({
    score: z
        .number({
            message: 'zodError.event.search.score.invalidType'
        })
        .min(0, { message: 'zodError.event.search.score.min' })
        .max(1, { message: 'zodError.event.search.score.max' })
        .optional()
});

/**
 * Schema for event search output
 * Uses generic paginated response with search results
 */
export const EventSearchOutputSchema = z.object({
    items: z.array(EventSearchResultSchema),
    pagination: z.object({
        page: z.number().min(1),
        pageSize: z.number().min(1).max(100),
        total: z.number().min(0),
        totalPages: z.number().min(0)
    }),
    searchInfo: z
        .object({
            query: z.string().optional(),
            executionTime: z.number().min(0).optional(),
            totalResults: z.number().min(0)
        })
        .optional()
});

// ============================================================================
// SUMMARY SCHEMA
// ============================================================================

/**
 * Schema for event summary
 * Contains essential information for quick display
 */
export const EventSummarySchema = EventSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    category: true,
    isFeatured: true,
    date: true,
    media: true,
    pricing: true
});

// ============================================================================
// STATS SCHEMA
// ============================================================================

/**
 * Schema for event statistics
 * Contains metrics and analytics data
 */
export const EventStatsSchema = z.object({
    // Event count statistics
    totalEvents: z
        .number({
            message: 'zodError.event.stats.totalEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.totalEvents.int' })
        .min(0, { message: 'zodError.event.stats.totalEvents.min' })
        .default(0),

    publishedEvents: z
        .number({
            message: 'zodError.event.stats.publishedEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.publishedEvents.int' })
        .min(0, { message: 'zodError.event.stats.publishedEvents.min' })
        .default(0),

    upcomingEvents: z
        .number({
            message: 'zodError.event.stats.upcomingEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.upcomingEvents.int' })
        .min(0, { message: 'zodError.event.stats.upcomingEvents.min' })
        .default(0),

    ongoingEvents: z
        .number({
            message: 'zodError.event.stats.ongoingEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.ongoingEvents.int' })
        .min(0, { message: 'zodError.event.stats.ongoingEvents.min' })
        .default(0),

    pastEvents: z
        .number({
            message: 'zodError.event.stats.pastEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.pastEvents.int' })
        .min(0, { message: 'zodError.event.stats.pastEvents.min' })
        .default(0),

    cancelledEvents: z
        .number({
            message: 'zodError.event.stats.cancelledEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.cancelledEvents.int' })
        .min(0, { message: 'zodError.event.stats.cancelledEvents.min' })
        .default(0),

    featuredEvents: z
        .number({
            message: 'zodError.event.stats.featuredEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.featuredEvents.int' })
        .min(0, { message: 'zodError.event.stats.featuredEvents.min' })
        .default(0),

    recurringEvents: z
        .number({
            message: 'zodError.event.stats.recurringEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.recurringEvents.int' })
        .min(0, { message: 'zodError.event.stats.recurringEvents.min' })
        .default(0),

    // Category distribution
    categoryDistribution: z
        .array(
            z.object({
                category: z.string(),
                count: z.number().int().min(0)
            })
        )
        .optional(),

    // Status distribution
    statusDistribution: z
        .object({
            draft: z.number().int().min(0).default(0),
            published: z.number().int().min(0).default(0),
            cancelled: z.number().int().min(0).default(0),
            completed: z.number().int().min(0).default(0)
        })
        .optional(),

    // Attendance statistics
    totalAttendees: z
        .number({
            message: 'zodError.event.stats.totalAttendees.invalidType'
        })
        .int({ message: 'zodError.event.stats.totalAttendees.int' })
        .min(0, { message: 'zodError.event.stats.totalAttendees.min' })
        .default(0),

    averageAttendeesPerEvent: z
        .number({
            message: 'zodError.event.stats.averageAttendeesPerEvent.invalidType'
        })
        .min(0, { message: 'zodError.event.stats.averageAttendeesPerEvent.min' })
        .default(0),

    totalCapacity: z
        .number({
            message: 'zodError.event.stats.totalCapacity.invalidType'
        })
        .int({ message: 'zodError.event.stats.totalCapacity.int' })
        .min(0, { message: 'zodError.event.stats.totalCapacity.min' })
        .default(0),

    averageCapacityUtilization: z
        .number({
            message: 'zodError.event.stats.averageCapacityUtilization.invalidType'
        })
        .min(0, { message: 'zodError.event.stats.averageCapacityUtilization.min' })
        .max(100, { message: 'zodError.event.stats.averageCapacityUtilization.max' })
        .default(0),

    // Organizer statistics
    topOrganizers: z
        .array(
            z.object({
                organizerId: z.string().uuid(),
                organizerName: z.string().optional(),
                eventCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Duration statistics
    averageDurationHours: z
        .number({
            message: 'zodError.event.stats.averageDurationHours.invalidType'
        })
        .min(0, { message: 'zodError.event.stats.averageDurationHours.min' })
        .default(0),

    // Price statistics
    freeEvents: z
        .number({
            message: 'zodError.event.stats.freeEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.freeEvents.int' })
        .min(0, { message: 'zodError.event.stats.freeEvents.min' })
        .default(0),

    paidEvents: z
        .number({
            message: 'zodError.event.stats.paidEvents.invalidType'
        })
        .int({ message: 'zodError.event.stats.paidEvents.int' })
        .min(0, { message: 'zodError.event.stats.paidEvents.min' })
        .default(0),

    averageTicketPrice: z
        .number({
            message: 'zodError.event.stats.averageTicketPrice.invalidType'
        })
        .min(0, { message: 'zodError.event.stats.averageTicketPrice.min' })
        .default(0),

    // Geographic distribution
    topDestinations: z
        .array(
            z.object({
                destinationId: z.string().uuid(),
                destinationName: z.string().optional(),
                eventCount: z.number().int().min(0)
            })
        )
        .optional(),

    // Seasonal statistics
    eventsByMonth: z
        .array(
            z.object({
                month: z.number().int().min(1).max(12),
                eventCount: z.number().int().min(0),
                attendeesCount: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// SERVICE-SPECIFIC QUERY SCHEMAS
// ============================================================================

/**
 * Schema for getting events by author
 * Used by EventService.getByAuthor method
 */
export const EventByAuthorInputSchema = PaginationSchema.extend({
    authorId: z
        .string({
            message: 'zodError.event.byAuthor.authorId.required'
        })
        .uuid({ message: 'zodError.event.byAuthor.authorId.uuid' })
});

/**
 * Schema for getting events by location
 * Used by EventService.getByLocation method
 */
export const EventByLocationInputSchema = PaginationSchema.extend({
    locationId: z
        .string({
            message: 'zodError.event.byLocation.locationId.required'
        })
        .uuid({ message: 'zodError.event.byLocation.locationId.uuid' })
});

/**
 * Schema for getting events by organizer
 * Used by EventService.getByOrganizer method
 */
export const EventByOrganizerInputSchema = PaginationSchema.extend({
    organizerId: z
        .string({
            message: 'zodError.event.byOrganizer.organizerId.required'
        })
        .uuid({ message: 'zodError.event.byOrganizer.organizerId.uuid' })
});

/**
 * Schema for getting events by category
 * Used by EventService.getByCategory method
 */
export const EventByCategoryInputSchema = PaginationSchema.extend({
    category: EventCategoryEnumSchema
});

/**
 * Schema for getting upcoming events
 * Used by EventService.getUpcoming method
 */
export const EventUpcomingInputSchema = PaginationSchema.extend({
    fromDate: z.date({
        message: 'zodError.event.upcoming.fromDate.required'
    }),
    toDate: z
        .date({
            message: 'zodError.event.upcoming.toDate.invalidType'
        })
        .optional()
});

/**
 * Schema for getting free events
 * Used by EventService.getFreeEvents method
 */
export const EventFreeInputSchema = PaginationSchema;

/**
 * Schema for getting event summary
 * Used by EventService.getSummary method
 */
export const EventSummaryInputSchema = z
    .object({
        id: z
            .string({
                message: 'zodError.event.summary.id.required'
            })
            .uuid({ message: 'zodError.event.summary.id.uuid' })
    })
    .strict();

/**
 * Schema for event summary output
 * Used by EventService.getSummary method response
 */
export const EventSummaryOutputSchema = z.object({
    summary: EventSummarySchema
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventFilters = z.infer<typeof EventFiltersSchema>;
export type EventListInput = z.infer<typeof EventListInputSchema>;
export type EventListItem = z.infer<typeof EventListItemSchema>;
export type EventListOutput = z.infer<typeof EventListOutputSchema>;
export type EventSearchInput = z.infer<typeof EventSearchInputSchema>;
export type EventSearchResult = z.infer<typeof EventSearchResultSchema>;
export type EventSearchOutput = z.infer<typeof EventSearchOutputSchema>;
export type EventSummary = z.infer<typeof EventSummarySchema>;
export type EventStats = z.infer<typeof EventStatsSchema>;

// Service-specific types
export type EventByAuthorInput = z.infer<typeof EventByAuthorInputSchema>;
export type EventByLocationInput = z.infer<typeof EventByLocationInputSchema>;
export type EventByOrganizerInput = z.infer<typeof EventByOrganizerInputSchema>;
export type EventByCategoryInput = z.infer<typeof EventByCategoryInputSchema>;
export type EventUpcomingInput = z.infer<typeof EventUpcomingInputSchema>;
export type EventFreeInput = z.infer<typeof EventFreeInputSchema>;
export type EventSummaryInput = z.infer<typeof EventSummaryInputSchema>;
export type EventSummaryOutput = z.infer<typeof EventSummaryOutputSchema>;
