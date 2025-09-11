import { z } from 'zod';
import {
    AccommodationIdSchema,
    AttractionIdSchema,
    DestinationReviewIdSchema,
    EventIdSchema,
    PostIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { DestinationSchema } from './destination.schema.js';

/**
 * Destination Relations Schemas
 *
 * This file contains schemas for destinations with related entities:
 * - DestinationWithAccommodations
 * - DestinationWithAttractions
 * - DestinationWithReviews
 * - DestinationWithEvents
 * - DestinationWithPosts
 * - DestinationWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Accommodation summary schema for relations
 * Contains essential accommodation information
 */
const AccommodationSummarySchema = z.object({
    id: AccommodationIdSchema,
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.string(),
    isFeatured: z.boolean(),
    rating: z.number().min(0).max(5).optional(),
    price: z
        .object({
            basePrice: z.number().min(0),
            currency: z.string()
        })
        .optional(),
    media: z
        .object({
            images: z.array(z.string()).optional(),
            videos: z.array(z.string()).optional()
        })
        .optional(),
    createdAt: z.date()
});

/**
 * Attraction summary schema for relations
 * Contains essential attraction information
 */
const AttractionSummarySchema = z.object({
    id: AttractionIdSchema,
    name: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    location: z
        .object({
            address: z.string().optional(),
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
    isPopular: z.boolean().optional()
});

/**
 * Review summary schema for relations
 * Contains essential review information
 */
const ReviewSummarySchema = z.object({
    id: DestinationReviewIdSchema,
    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().optional(),
    userId: UserIdSchema,
    userName: z.string().optional(),
    createdAt: z.date(),
    isVerified: z.boolean().optional()
});

/**
 * Event summary schema for relations
 * Contains essential event information
 */
const EventSummarySchema = z.object({
    id: EventIdSchema,
    slug: z.string(),
    name: z.string(),
    summary: z.string().optional(),
    category: z.string().optional(),
    startDate: z.date(),
    endDate: z.date().optional(),
    location: z
        .object({
            venue: z.string().optional(),
            address: z.string().optional()
        })
        .optional(),
    isFeatured: z.boolean(),
    isRecurring: z.boolean().optional(),
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional()
});

/**
 * Post summary schema for relations
 * Contains essential post information
 */
const PostSummarySchema = z.object({
    id: PostIdSchema,
    slug: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    category: z.string().optional(),
    publishedAt: z.date().optional(),
    isFeatured: z.boolean(),
    author: z
        .object({
            id: UserIdSchema,
            displayName: z.string().optional(),
            firstName: z.string().optional(),
            lastName: z.string().optional()
        })
        .optional(),
    media: z
        .object({
            featuredImage: z.string().optional(),
            images: z.array(z.string()).optional()
        })
        .optional()
});

// ============================================================================
// DESTINATION WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Destination with accommodations
 * Includes an array of accommodations in this destination
 */
export const DestinationWithAccommodationsSchema = DestinationSchema.extend({
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional()
});

/**
 * Destination with attractions
 * Includes an array of attractions in this destination
 */
export const DestinationWithAttractionsSchema = DestinationSchema.extend({
    attractions: z.array(AttractionSummarySchema).optional(),
    attractionsCount: z.number().int().min(0).optional(),
    popularAttractions: z.array(AttractionSummarySchema).optional()
});

/**
 * Destination with reviews
 * Includes reviews for this destination
 */
export const DestinationWithReviewsSchema = DestinationSchema.extend({
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional(),
    ratingDistribution: z
        .object({
            oneStar: z.number().int().min(0),
            twoStars: z.number().int().min(0),
            threeStars: z.number().int().min(0),
            fourStars: z.number().int().min(0),
            fiveStars: z.number().int().min(0)
        })
        .optional()
});

/**
 * Destination with events
 * Includes events happening in this destination
 */
export const DestinationWithEventsSchema = DestinationSchema.extend({
    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional(),
    upcomingEvents: z.array(EventSummarySchema).optional(),
    featuredEvents: z.array(EventSummarySchema).optional()
});

/**
 * Destination with posts
 * Includes blog posts/articles about this destination
 */
export const DestinationWithPostsSchema = DestinationSchema.extend({
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

/**
 * Destination with content relations
 * Includes accommodations, attractions, and reviews
 */
export const DestinationWithContentRelationsSchema = DestinationSchema.extend({
    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),

    // Attractions
    attractions: z.array(AttractionSummarySchema).optional(),
    attractionsCount: z.number().int().min(0).optional(),
    popularAttractions: z.array(AttractionSummarySchema).optional(),

    // Reviews
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});

/**
 * Destination with activity relations
 * Includes events and posts
 */
export const DestinationWithActivityRelationsSchema = DestinationSchema.extend({
    // Events
    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional(),
    upcomingEvents: z.array(EventSummarySchema).optional(),
    featuredEvents: z.array(EventSummarySchema).optional(),

    // Posts
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

/**
 * Destination with all relations
 * Includes all possible related entities
 */
export const DestinationWithFullRelationsSchema = DestinationSchema.extend({
    // Accommodations
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),

    // Attractions
    attractions: z.array(AttractionSummarySchema).optional(),
    attractionsCount: z.number().int().min(0).optional(),
    popularAttractions: z.array(AttractionSummarySchema).optional(),

    // Reviews
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional(),
    ratingDistribution: z
        .object({
            oneStar: z.number().int().min(0),
            twoStars: z.number().int().min(0),
            threeStars: z.number().int().min(0),
            fourStars: z.number().int().min(0),
            fiveStars: z.number().int().min(0)
        })
        .optional(),

    // Events
    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional(),
    upcomingEvents: z.array(EventSummarySchema).optional(),
    featuredEvents: z.array(EventSummarySchema).optional(),

    // Posts
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

// ============================================================================
// DESTINATION DISCOVERY SCHEMAS
// ============================================================================

/**
 * Destination with nearby destinations
 * Includes related/nearby destinations for discovery
 */
export const DestinationWithNearbySchema = DestinationSchema.extend({
    nearbyDestinations: z
        .array(
            DestinationSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                location: true,
                media: true,
                rating: true,
                accommodationsCount: true,
                distance: true // Distance in kilometers
            }).extend({
                distance: z.number().min(0).optional()
            })
        )
        .optional(),

    similarDestinations: z
        .array(
            DestinationSchema.pick({
                id: true,
                slug: true,
                name: true,
                summary: true,
                location: true,
                media: true,
                rating: true,
                accommodationsCount: true
            })
        )
        .optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type DestinationWithAccommodations = z.infer<typeof DestinationWithAccommodationsSchema>;
export type DestinationWithAttractions = z.infer<typeof DestinationWithAttractionsSchema>;
export type DestinationWithReviews = z.infer<typeof DestinationWithReviewsSchema>;
export type DestinationWithEvents = z.infer<typeof DestinationWithEventsSchema>;
export type DestinationWithPosts = z.infer<typeof DestinationWithPostsSchema>;
export type DestinationWithContentRelations = z.infer<typeof DestinationWithContentRelationsSchema>;
export type DestinationWithActivityRelations = z.infer<
    typeof DestinationWithActivityRelationsSchema
>;
export type DestinationWithFullRelations = z.infer<typeof DestinationWithFullRelationsSchema>;
export type DestinationWithNearby = z.infer<typeof DestinationWithNearbySchema>;
