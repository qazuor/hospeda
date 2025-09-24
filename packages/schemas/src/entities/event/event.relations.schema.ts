import { z } from 'zod';
import { EventSchema } from './event.schema.js';

/**
 * Event Relations Schemas
 *
 * This file contains schemas for events with related entities:
 * - EventWithOrganizer
 * - EventWithLocation
 * - EventWithDestination
 * - EventWithAttendees
 * - EventWithTickets
 * - EventWithPosts
 * - EventWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Organizer summary schema for relations
 * Contains essential organizer information
 */
const OrganizerSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    website: z.string().optional(),
    logo: z.string().optional(),
    socialMedia: z
        .object({
            facebook: z.string().optional(),
            twitter: z.string().optional(),
            instagram: z.string().optional(),
            linkedin: z.string().optional()
        })
        .optional(),
    isVerified: z.boolean().optional(),
    eventsCount: z.number().int().min(0).optional()
});

/**
 * Location summary schema for relations
 * Contains essential location information
 */
const LocationSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    address: z.string(),
    city: z.string(),
    state: z.string().optional(),
    country: z.string(),
    postalCode: z.string().optional(),
    coordinates: z
        .object({
            latitude: z.number(),
            longitude: z.number()
        })
        .optional(),
    capacity: z.number().int().min(0).optional(),
    amenities: z.array(z.string()).optional(),
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional(),
    contactInfo: z
        .object({
            phone: z.string().optional(),
            email: z.string().email().optional(),
            website: z.string().optional()
        })
        .optional()
});

/**
 * Destination summary schema for relations
 * Contains essential destination information
 */
const DestinationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    isFeatured: z.boolean(),
    location: z
        .object({
            country: z.string(),
            state: z.string().optional(),
            city: z.string(),
            coordinates: z
                .object({
                    latitude: z.number(),
                    longitude: z.number()
                })
                .optional()
        })
        .optional(),
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional(),
    eventsCount: z.number().int().min(0).optional()
});

/**
 * Attendee summary schema for relations
 * Contains essential attendee information
 */
const AttendeeSummarySchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid().optional(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    registrationDate: z.date(),
    ticketType: z.string().optional(),
    status: z.enum(['registered', 'confirmed', 'attended', 'cancelled']),
    checkInTime: z.date().optional(),
    specialRequirements: z.string().optional()
});

/**
 * Ticket summary schema for relations
 * Contains essential ticket information
 */
const TicketSummarySchema = z.object({
    id: z.string().uuid(),
    type: z.string(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().min(0),
    currency: z.string(),
    quantity: z.number().int().min(0),
    sold: z.number().int().min(0),
    isActive: z.boolean(),
    saleStartDate: z.date().optional(),
    saleEndDate: z.date().optional(),
    transferable: z.boolean().optional(),
    refundable: z.boolean().optional()
});

/**
 * Post summary schema for relations
 * Contains essential post information
 */
const PostSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    category: z.string().optional(),
    publishedAt: z.coerce.date().optional(),
    isFeatured: z.boolean(),
    author: z
        .object({
            id: z.string().uuid(),
            displayName: z.string().optional(),
            firstName: z.string().optional(),
            lastName: z.string().optional()
        })
        .optional(),
    media: z
        .object({
            featuredImage: z.string().optional()
        })
        .optional()
});

// ============================================================================
// EVENT WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Event with organizer information
 * Includes the complete organizer data
 */
export const EventWithOrganizerSchema = EventSchema.extend({
    organizer: OrganizerSummarySchema.optional()
});

/**
 * Event with location information
 * Includes the complete location data
 */
export const EventWithLocationSchema = EventSchema.extend({
    eventLocation: LocationSummarySchema.optional()
});

/**
 * Event with destination information
 * Includes the related destination data
 */
export const EventWithDestinationSchema = EventSchema.extend({
    destination: DestinationSummarySchema.optional()
});

/**
 * Event with attendees
 * Includes an array of event attendees
 */
export const EventWithAttendeesSchema = EventSchema.extend({
    attendees: z.array(AttendeeSummarySchema).optional(),
    attendeesCount: z.number().int().min(0).optional(),
    confirmedAttendeesCount: z.number().int().min(0).optional(),
    attendedCount: z.number().int().min(0).optional(),
    cancelledAttendeesCount: z.number().int().min(0).optional()
});

/**
 * Event with tickets
 * Includes an array of ticket types for the event
 */
export const EventWithTicketsSchema = EventSchema.extend({
    tickets: z.array(TicketSummarySchema).optional(),
    ticketTypesCount: z.number().int().min(0).optional(),
    totalTicketsAvailable: z.number().int().min(0).optional(),
    totalTicketsSold: z.number().int().min(0).optional(),
    totalRevenue: z.number().min(0).optional()
});

/**
 * Event with posts
 * Includes blog posts/articles about this event
 */
export const EventWithPostsSchema = EventSchema.extend({
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

/**
 * Event with basic relations
 * Includes organizer, location, and destination
 */
export const EventWithBasicRelationsSchema = EventSchema.extend({
    organizer: OrganizerSummarySchema.optional(),
    eventLocation: LocationSummarySchema.optional(),
    destination: DestinationSummarySchema.optional()
});

/**
 * Event with business relations
 * Includes attendees and tickets
 */
export const EventWithBusinessRelationsSchema = EventSchema.extend({
    // Attendees
    attendees: z.array(AttendeeSummarySchema).optional(),
    attendeesCount: z.number().int().min(0).optional(),
    confirmedAttendeesCount: z.number().int().min(0).optional(),
    attendedCount: z.number().int().min(0).optional(),
    cancelledAttendeesCount: z.number().int().min(0).optional(),

    // Tickets
    tickets: z.array(TicketSummarySchema).optional(),
    ticketTypesCount: z.number().int().min(0).optional(),
    totalTicketsAvailable: z.number().int().min(0).optional(),
    totalTicketsSold: z.number().int().min(0).optional(),
    totalRevenue: z.number().min(0).optional()
});

/**
 * Event with all relations
 * Includes all possible related entities
 */
export const EventWithFullRelationsSchema = EventSchema.extend({
    // Basic relations
    organizer: OrganizerSummarySchema.optional(),
    eventLocation: LocationSummarySchema.optional(),
    destination: DestinationSummarySchema.optional(),

    // Attendees
    attendees: z.array(AttendeeSummarySchema).optional(),
    attendeesCount: z.number().int().min(0).optional(),
    confirmedAttendeesCount: z.number().int().min(0).optional(),
    attendedCount: z.number().int().min(0).optional(),
    cancelledAttendeesCount: z.number().int().min(0).optional(),

    // Tickets
    tickets: z.array(TicketSummarySchema).optional(),
    ticketTypesCount: z.number().int().min(0).optional(),
    totalTicketsAvailable: z.number().int().min(0).optional(),
    totalTicketsSold: z.number().int().min(0).optional(),
    totalRevenue: z.number().min(0).optional(),

    // Posts
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

// ============================================================================
// EVENT SERIES SCHEMAS
// ============================================================================

/**
 * Event with series information
 * Includes related events in the same series
 */
export const EventWithSeriesSchema = EventSchema.extend({
    series: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().optional(),
            totalEvents: z.number().int().min(0),
            currentEventIndex: z.number().int().min(1)
        })
        .optional(),

    seriesEvents: z
        .array(
            EventSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                startDate: true,
                endDate: true,
                location: true,
                media: true,
                attendeesCount: true
            }).extend({
                seriesIndex: z.number().int().min(1)
            })
        )
        .optional(),

    previousEvent: EventSchema.pick({
        id: true,
        slug: true,
        name: true,
        summary: true,
        startDate: true,
        endDate: true
    }).optional(),

    nextEvent: EventSchema.pick({
        id: true,
        slug: true,
        name: true,
        summary: true,
        startDate: true,
        endDate: true
    }).optional()
});

// ============================================================================
// EVENT RECOMMENDATIONS SCHEMAS
// ============================================================================

/**
 * Event with recommendations
 * Includes similar and related events for discovery
 */
export const EventWithRecommendationsSchema = EventSchema.extend({
    similarEvents: z
        .array(
            EventSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                category: true,
                startDate: true,
                endDate: true,
                location: true,
                media: true,
                attendeesCount: true,
                price: true
            })
        )
        .optional(),

    relatedEvents: z
        .array(
            EventSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                category: true,
                startDate: true,
                endDate: true,
                location: true,
                media: true,
                attendeesCount: true,
                price: true
            })
        )
        .optional(),

    nearbyEvents: z
        .array(
            EventSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                startDate: true,
                endDate: true,
                location: true,
                media: true,
                attendeesCount: true
            }).extend({
                distance: z.number().min(0).optional()
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type EventWithOrganizer = z.infer<typeof EventWithOrganizerSchema>;
export type EventWithLocation = z.infer<typeof EventWithLocationSchema>;
export type EventWithDestination = z.infer<typeof EventWithDestinationSchema>;
export type EventWithAttendees = z.infer<typeof EventWithAttendeesSchema>;
export type EventWithTickets = z.infer<typeof EventWithTicketsSchema>;
export type EventWithPosts = z.infer<typeof EventWithPostsSchema>;
export type EventWithBasicRelations = z.infer<typeof EventWithBasicRelationsSchema>;
export type EventWithBusinessRelations = z.infer<typeof EventWithBusinessRelationsSchema>;
export type EventWithFullRelations = z.infer<typeof EventWithFullRelationsSchema>;
export type EventWithSeries = z.infer<typeof EventWithSeriesSchema>;
export type EventWithRecommendations = z.infer<typeof EventWithRecommendationsSchema>;
