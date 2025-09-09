import { z } from 'zod';
import { PostSchema } from './post.schema.js';

/**
 * Post Relations Schemas
 *
 * This file contains schemas for posts with related entities:
 * - PostWithAuthor
 * - PostWithDestinations
 * - PostWithAccommodations
 * - PostWithEvents
 * - PostWithSponsorship
 * - PostWithComments
 * - PostWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Author summary schema for relations
 * Contains essential author information
 */
const AuthorSummarySchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string(),
    profilePicture: z.string().optional(),
    bio: z.string().optional(),
    isActive: z.boolean()
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
    accommodationsCount: z.number().int().min(0).optional()
});

/**
 * Accommodation summary schema for relations
 * Contains essential accommodation information
 */
const AccommodationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
    type: z.string(),
    isFeatured: z.boolean(),
    rating: z.number().min(0).max(5).optional(),
    location: z
        .object({
            country: z.string(),
            state: z.string().optional(),
            city: z.string()
        })
        .optional(),
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional(),
    price: z
        .object({
            basePrice: z.number().min(0),
            currency: z.string()
        })
        .optional()
});

/**
 * Event summary schema for relations
 * Contains essential event information
 */
const EventSummarySchema = z.object({
    id: z.string().uuid(),
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
    media: z
        .object({
            images: z.array(z.string()).optional()
        })
        .optional()
});

/**
 * Sponsorship summary schema for relations
 * Contains essential sponsorship information
 */
const SponsorshipSummarySchema = z.object({
    id: z.string().uuid(),
    sponsor: z.object({
        id: z.string().uuid(),
        name: z.string(),
        logo: z.string().optional(),
        website: z.string().optional()
    }),
    type: z.string(),
    startDate: z.date(),
    endDate: z.date().optional(),
    isActive: z.boolean(),
    displaySettings: z
        .object({
            showLogo: z.boolean().optional(),
            showBadge: z.boolean().optional(),
            customMessage: z.string().optional()
        })
        .optional()
});

/**
 * Comment summary schema for relations
 * Contains essential comment information
 */
const CommentSummarySchema = z.object({
    id: z.string().uuid(),
    content: z.string(),
    author: z.object({
        id: z.string().uuid(),
        displayName: z.string().optional(),
        profilePicture: z.string().optional()
    }),
    createdAt: z.date(),
    isApproved: z.boolean(),
    parentId: z.string().uuid().optional(),
    repliesCount: z.number().int().min(0).optional()
});

// ============================================================================
// POST WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Post with author information
 * Includes the complete author data
 */
export const PostWithAuthorSchema = PostSchema.extend({
    author: AuthorSummarySchema.optional()
});

/**
 * Post with destinations
 * Includes an array of related destinations
 */
export const PostWithDestinationsSchema = PostSchema.extend({
    destinations: z.array(DestinationSummarySchema).optional(),
    destinationsCount: z.number().int().min(0).optional()
});

/**
 * Post with accommodations
 * Includes an array of related accommodations
 */
export const PostWithAccommodationsSchema = PostSchema.extend({
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional()
});

/**
 * Post with events
 * Includes an array of related events
 */
export const PostWithEventsSchema = PostSchema.extend({
    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional()
});

/**
 * Post with sponsorship information
 * Includes sponsorship details if the post is sponsored
 */
export const PostWithSponsorshipSchema = PostSchema.extend({
    sponsorship: SponsorshipSummarySchema.optional(),
    isSponsored: z.boolean().optional()
});

/**
 * Post with comments
 * Includes an array of comments on the post
 */
export const PostWithCommentsSchema = PostSchema.extend({
    comments: z.array(CommentSummarySchema).optional(),
    commentsCount: z.number().int().min(0).optional(),
    approvedCommentsCount: z.number().int().min(0).optional(),
    pendingCommentsCount: z.number().int().min(0).optional()
});

/**
 * Post with content relations
 * Includes destinations, accommodations, and events
 */
export const PostWithContentRelationsSchema = PostSchema.extend({
    // Author
    author: AuthorSummarySchema.optional(),

    // Related content
    destinations: z.array(DestinationSummarySchema).optional(),
    destinationsCount: z.number().int().min(0).optional(),

    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),

    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional()
});

/**
 * Post with engagement relations
 * Includes comments and sponsorship
 */
export const PostWithEngagementRelationsSchema = PostSchema.extend({
    // Author
    author: AuthorSummarySchema.optional(),

    // Sponsorship
    sponsorship: SponsorshipSummarySchema.optional(),
    isSponsored: z.boolean().optional(),

    // Comments
    comments: z.array(CommentSummarySchema).optional(),
    commentsCount: z.number().int().min(0).optional(),
    approvedCommentsCount: z.number().int().min(0).optional(),
    pendingCommentsCount: z.number().int().min(0).optional()
});

/**
 * Post with all relations
 * Includes all possible related entities
 */
export const PostWithFullRelationsSchema = PostSchema.extend({
    // Author
    author: AuthorSummarySchema.optional(),

    // Related content
    destinations: z.array(DestinationSummarySchema).optional(),
    destinationsCount: z.number().int().min(0).optional(),

    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),

    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional(),

    // Sponsorship
    sponsorship: SponsorshipSummarySchema.optional(),
    isSponsored: z.boolean().optional(),

    // Comments
    comments: z.array(CommentSummarySchema).optional(),
    commentsCount: z.number().int().min(0).optional(),
    approvedCommentsCount: z.number().int().min(0).optional(),
    pendingCommentsCount: z.number().int().min(0).optional()
});

// ============================================================================
// POST SERIES SCHEMAS
// ============================================================================

/**
 * Post with series information
 * Includes related posts in the same series
 */
export const PostWithSeriesSchema = PostSchema.extend({
    series: z
        .object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().optional(),
            totalPosts: z.number().int().min(0),
            currentPostIndex: z.number().int().min(1)
        })
        .optional(),

    seriesPosts: z
        .array(
            PostSchema.pick({
                id: true,
                slug: true,
                title: true,
                summary: true,
                publishedAt: true,
                readingTimeMinutes: true,
                media: true
            }).extend({
                seriesIndex: z.number().int().min(1)
            })
        )
        .optional(),

    previousPost: PostSchema.pick({
        id: true,
        slug: true,
        title: true,
        summary: true
    }).optional(),

    nextPost: PostSchema.pick({
        id: true,
        slug: true,
        title: true,
        summary: true
    }).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostWithAuthor = z.infer<typeof PostWithAuthorSchema>;
export type PostWithDestinations = z.infer<typeof PostWithDestinationsSchema>;
export type PostWithAccommodations = z.infer<typeof PostWithAccommodationsSchema>;
export type PostWithEvents = z.infer<typeof PostWithEventsSchema>;
export type PostWithSponsorship = z.infer<typeof PostWithSponsorshipSchema>;
export type PostWithComments = z.infer<typeof PostWithCommentsSchema>;
export type PostWithContentRelations = z.infer<typeof PostWithContentRelationsSchema>;
export type PostWithEngagementRelations = z.infer<typeof PostWithEngagementRelationsSchema>;
export type PostWithFullRelations = z.infer<typeof PostWithFullRelationsSchema>;
export type PostWithSeries = z.infer<typeof PostWithSeriesSchema>;
