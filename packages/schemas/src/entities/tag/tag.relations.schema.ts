import { z } from 'zod';
import { TagSchema } from './tag.schema.js';

/**
 * Tag Relations Schemas
 *
 * This file contains schemas for tags with related entities:
 * - TagWithUsageStats
 * - TagWithEntities
 * - TagWithAccommodations
 * - TagWithDestinations
 * - TagWithPosts
 * - TagWithEvents
 * - TagWithUsers
 * - TagWithFull (all relations)
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
    createdAt: z.date()
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
            city: z.string()
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
    attendeesCount: z.number().int().min(0).optional()
});

/**
 * User summary schema for relations
 * Contains essential user information
 */
const UserSummarySchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string(),
    profilePicture: z.string().optional(),
    isActive: z.boolean()
});

// ============================================================================
// TAG WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Tag with usage statistics
 * Includes detailed usage breakdown by entity type
 */
export const TagWithUsageStatsSchema = TagSchema.extend({
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        destinationsCount: z.number().int().min(0),
        postsCount: z.number().int().min(0),
        eventsCount: z.number().int().min(0),
        usersCount: z.number().int().min(0),
        lastUsedAt: z.date().optional(),
        firstUsedAt: z.date().optional(),
        usageGrowthRate: z.number().optional(),
        popularityRank: z.number().int().min(1).optional()
    })
});

/**
 * Tag with all entity counts
 * Includes counts for each entity type without full entity data
 */
export const TagWithEntitiesSchema = TagSchema.extend({
    entities: z.object({
        accommodations: z.object({
            count: z.number().int().min(0),
            featuredCount: z.number().int().min(0).optional()
        }),
        destinations: z.object({
            count: z.number().int().min(0),
            featuredCount: z.number().int().min(0).optional()
        }),
        posts: z.object({
            count: z.number().int().min(0),
            publishedCount: z.number().int().min(0).optional(),
            featuredCount: z.number().int().min(0).optional()
        }),
        events: z.object({
            count: z.number().int().min(0),
            upcomingCount: z.number().int().min(0).optional(),
            featuredCount: z.number().int().min(0).optional()
        }),
        users: z.object({
            count: z.number().int().min(0),
            activeCount: z.number().int().min(0).optional()
        })
    })
});

/**
 * Tag with accommodations
 * Includes an array of accommodations using this tag
 */
export const TagWithAccommodationsSchema = TagSchema.extend({
    accommodations: z.array(AccommodationSummarySchema).optional(),
    accommodationsCount: z.number().int().min(0).optional(),
    featuredAccommodations: z.array(AccommodationSummarySchema).optional()
});

/**
 * Tag with destinations
 * Includes an array of destinations using this tag
 */
export const TagWithDestinationsSchema = TagSchema.extend({
    destinations: z.array(DestinationSummarySchema).optional(),
    destinationsCount: z.number().int().min(0).optional(),
    featuredDestinations: z.array(DestinationSummarySchema).optional()
});

/**
 * Tag with posts
 * Includes an array of posts using this tag
 */
export const TagWithPostsSchema = TagSchema.extend({
    posts: z.array(PostSummarySchema).optional(),
    postsCount: z.number().int().min(0).optional(),
    publishedPosts: z.array(PostSummarySchema).optional(),
    featuredPosts: z.array(PostSummarySchema).optional()
});

/**
 * Tag with events
 * Includes an array of events using this tag
 */
export const TagWithEventsSchema = TagSchema.extend({
    events: z.array(EventSummarySchema).optional(),
    eventsCount: z.number().int().min(0).optional(),
    upcomingEvents: z.array(EventSummarySchema).optional(),
    featuredEvents: z.array(EventSummarySchema).optional()
});

/**
 * Tag with users
 * Includes an array of users using this tag
 */
export const TagWithUsersSchema = TagSchema.extend({
    users: z.array(UserSummarySchema).optional(),
    usersCount: z.number().int().min(0).optional(),
    activeUsers: z.array(UserSummarySchema).optional()
});

/**
 * Tag with content relations
 * Includes accommodations, destinations, posts, and events
 */
export const TagWithContentRelationsSchema = TagSchema.extend({
    // Usage statistics
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        destinationsCount: z.number().int().min(0),
        postsCount: z.number().int().min(0),
        eventsCount: z.number().int().min(0),
        lastUsedAt: z.date().optional()
    }),

    // Content entities
    accommodations: z.array(AccommodationSummarySchema).optional(),
    destinations: z.array(DestinationSummarySchema).optional(),
    posts: z.array(PostSummarySchema).optional(),
    events: z.array(EventSummarySchema).optional()
});

/**
 * Tag with all relations
 * Includes all possible related entities and statistics
 */
export const TagWithFullRelationsSchema = TagSchema.extend({
    // Detailed usage statistics
    usageStats: z.object({
        totalUsages: z.number().int().min(0),
        accommodationsCount: z.number().int().min(0),
        destinationsCount: z.number().int().min(0),
        postsCount: z.number().int().min(0),
        eventsCount: z.number().int().min(0),
        usersCount: z.number().int().min(0),
        lastUsedAt: z.date().optional(),
        firstUsedAt: z.date().optional(),
        usageGrowthRate: z.number().optional(),
        popularityRank: z.number().int().min(1).optional()
    }),

    // All entities
    accommodations: z.array(AccommodationSummarySchema).optional(),
    destinations: z.array(DestinationSummarySchema).optional(),
    posts: z.array(PostSummarySchema).optional(),
    events: z.array(EventSummarySchema).optional(),
    users: z.array(UserSummarySchema).optional(),

    // Featured content
    featuredAccommodations: z.array(AccommodationSummarySchema).optional(),
    featuredDestinations: z.array(DestinationSummarySchema).optional(),
    featuredPosts: z.array(PostSummarySchema).optional(),
    featuredEvents: z.array(EventSummarySchema).optional()
});

// ============================================================================
// TAG CLOUD SCHEMAS
// ============================================================================

/**
 * Tag cloud item schema
 * Contains tag information for tag cloud display
 */
export const TagCloudItemSchema = TagSchema.pick({
    id: true,
    name: true,
    color: true,
    usageCount: true
}).extend({
    weight: z.number().min(0).max(1), // Normalized weight for display
    fontSize: z.number().min(8).max(48).optional(), // Suggested font size
    popularity: z.enum(['low', 'medium', 'high', 'trending']).optional()
});

/**
 * Tag cloud input schema
 * Parameters for generating tag clouds
 */
export const TagCloudInputSchema = z.object({
    maxTags: z
        .number({
            message: 'zodError.tag.cloud.maxTags.invalidType'
        })
        .int({ message: 'zodError.tag.cloud.maxTags.int' })
        .min(10, { message: 'zodError.tag.cloud.maxTags.min' })
        .max(200, { message: 'zodError.tag.cloud.maxTags.max' })
        .optional()
        .default(50),
    entityType: z
        .enum(['all', 'accommodations', 'destinations', 'posts', 'events', 'users'], {
            message: 'zodError.tag.cloud.entityType.enum'
        })
        .optional()
        .default('all'),
    timeframe: z
        .enum(['all', 'year', 'month', 'week'], {
            message: 'zodError.tag.cloud.timeframe.enum'
        })
        .optional()
        .default('all'),
    minUsageCount: z
        .number({
            message: 'zodError.tag.cloud.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.tag.cloud.minUsageCount.int' })
        .min(1, { message: 'zodError.tag.cloud.minUsageCount.min' })
        .optional()
        .default(1)
});

/**
 * Tag cloud output schema
 * Returns formatted tag cloud data
 */
export const TagCloudOutputSchema = z.object({
    tags: z.array(TagCloudItemSchema),
    metadata: z.object({
        totalTags: z.number().int().min(0),
        entityType: z.string(),
        timeframe: z.string(),
        minUsageCount: z.number().int().min(0),
        maxUsageCount: z.number().int().min(0),
        generatedAt: z.date()
    })
});

// ============================================================================
// RELATED TAGS SCHEMAS
// ============================================================================

/**
 * Related tags input schema
 * Parameters for finding related tags
 */
export const RelatedTagsInputSchema = z.object({
    tagId: z.string().uuid(),
    limit: z
        .number({
            message: 'zodError.tag.related.limit.invalidType'
        })
        .int({ message: 'zodError.tag.related.limit.int' })
        .min(1, { message: 'zodError.tag.related.limit.min' })
        .max(50, { message: 'zodError.tag.related.limit.max' })
        .optional()
        .default(10),
    entityType: z
        .enum(['all', 'accommodations', 'destinations', 'posts', 'events', 'users'], {
            message: 'zodError.tag.related.entityType.enum'
        })
        .optional()
        .default('all')
});

/**
 * Related tags output schema
 * Returns tags that are commonly used together
 */
export const RelatedTagsOutputSchema = z.object({
    relatedTags: z.array(
        TagSchema.pick({
            id: true,
            name: true,
            color: true,
            usageCount: true
        }).extend({
            relationStrength: z.number().min(0).max(1), // How often used together
            coOccurrenceCount: z.number().int().min(0) // Number of entities with both tags
        })
    ),
    metadata: z.object({
        sourceTagId: z.string().uuid(),
        sourceTagName: z.string(),
        entityType: z.string(),
        totalRelatedTags: z.number().int().min(0)
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TagWithUsageStats = z.infer<typeof TagWithUsageStatsSchema>;
export type TagWithEntities = z.infer<typeof TagWithEntitiesSchema>;
export type TagWithAccommodations = z.infer<typeof TagWithAccommodationsSchema>;
export type TagWithDestinations = z.infer<typeof TagWithDestinationsSchema>;
export type TagWithPosts = z.infer<typeof TagWithPostsSchema>;
export type TagWithEvents = z.infer<typeof TagWithEventsSchema>;
export type TagWithUsers = z.infer<typeof TagWithUsersSchema>;
export type TagWithContentRelations = z.infer<typeof TagWithContentRelationsSchema>;
export type TagWithFullRelations = z.infer<typeof TagWithFullRelationsSchema>;
export type TagCloudItem = z.infer<typeof TagCloudItemSchema>;
export type TagCloudInput = z.infer<typeof TagCloudInputSchema>;
export type TagCloudOutput = z.infer<typeof TagCloudOutputSchema>;
export type RelatedTagsInput = z.infer<typeof RelatedTagsInputSchema>;
export type RelatedTagsOutput = z.infer<typeof RelatedTagsOutputSchema>;
