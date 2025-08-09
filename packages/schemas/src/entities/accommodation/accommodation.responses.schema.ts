import { z } from 'zod';
import { ContactInfoSchema, LocationSchema, SocialNetworkSchema } from '../../common/index.js';
import { DestinationSchema } from '../destination/destination.schema.js';
import { UserSchema } from '../user/user.schema.js';
import { AccommodationCoreSchema, AccommodationPriceSchema } from './accommodation.base.schema.js';

/**
 * Schema for accommodation list items (minimal data for performance)
 * Used in: GET /accommodations (list endpoint)
 */
export const AccommodationListItemSchema = AccommodationCoreSchema.pick({
    id: true,
    slug: true,
    name: true,
    summary: true,
    type: true,
    visibility: true,
    isFeatured: true,
    destinationId: true,
    reviewsCount: true,
    averageRating: true
}).extend({
    // Add minimal media info for list view
    featuredImage: z
        .string()
        .url({ message: 'zodError.accommodation.featuredImage.invalidUrl' })
        .optional(),

    // Basic price info for list view
    priceRange: z
        .object({
            min: z.number().min(0),
            max: z.number().min(0),
            currency: z.string().length(3) // ISO currency code
        })
        .optional(),

    // Location for search/filtering
    city: z.string().optional(),
    country: z.string().optional()
});

/**
 * Schema for accommodation detail view (comprehensive but no lazy-loaded data)
 * Used in: GET /accommodations/:id, GET /accommodations/slug/:slug
 */
export const AccommodationDetailSchema = AccommodationCoreSchema.extend({
    // Media information (simplified to avoid lazy schemas for OpenAPI)
    media: z
        .object({
            featuredImage: z
                .object({
                    url: z.string().url(),
                    caption: z.string().optional(),
                    description: z.string().optional()
                })
                .optional(),
            gallery: z
                .array(
                    z.object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                )
                .optional(),
            videos: z
                .array(
                    z.object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                )
                .optional()
        })
        .optional(),

    // Complete location data
    location: LocationSchema.optional(),

    // Full price information
    price: AccommodationPriceSchema.optional(),

    // Contact information
    contactInfo: ContactInfoSchema.optional(),

    // Social networks
    socialNetworks: SocialNetworkSchema.optional(),

    // Features and amenities
    features: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().optional(),
                icon: z.string().optional(),
                category: z.string().optional()
            })
        )
        .optional(),
    amenities: z
        .array(
            z.object({
                id: z.string().uuid(),
                name: z.string(),
                description: z.string().optional(),
                icon: z.string().optional(),
                category: z.string().optional(),
                isAvailable: z.boolean().default(true)
            })
        )
        .optional(),

    // SEO data
    seo: z
        .object({
            title: z.string().min(30).max(60).optional(),
            description: z.string().min(70).max(160).optional(),
            keywords: z.array(z.string()).optional()
        })
        .optional(),

    // Basic relation data (not full objects to avoid circular deps)
    destination: DestinationSchema.pick({
        id: true,
        name: true,
        slug: true,
        country: true,
        timezone: true
    }).optional(),

    owner: UserSchema.pick({
        id: true,
        name: true,
        email: true,
        avatar: true
    }).optional()
});

/**
 * Schema for accommodation with tags (used when tags are needed)
 * Note: Uses string array to avoid TagSchema circular dependency
 */
export const AccommodationWithTagsSchema = AccommodationDetailSchema.extend({
    tags: z
        .array(
            z.object({
                id: z.string(),
                name: z.string(),
                slug: z.string(),
                color: z.string()
            })
        )
        .optional()
});

/**
 * Schema for accommodation summary (stats and basic info)
 * Used in: GET /accommodations/:id/summary
 */
export const AccommodationSummarySchema = AccommodationCoreSchema.pick({
    id: true,
    name: true,
    summary: true,
    type: true,
    reviewsCount: true,
    averageRating: true,
    isFeatured: true
}).extend({
    featuredImage: z.string().url().optional(),
    location: z
        .object({
            city: z.string().optional(),
            country: z.string().optional()
        })
        .optional()
});

/**
 * Schema for accommodation statistics
 * Used in: GET /accommodations/:id/stats
 */
export const AccommodationStatsSchema = z.object({
    accommodation: AccommodationCoreSchema.pick({
        id: true,
        name: true
    }),
    stats: z.object({
        reviewsCount: z.number().int().min(0),
        averageRating: z.number().min(0).max(5),
        ratingDistribution: z.object({
            1: z.number().int().min(0),
            2: z.number().int().min(0),
            3: z.number().int().min(0),
            4: z.number().int().min(0),
            5: z.number().int().min(0)
        }),
        totalBookings: z.number().int().min(0).optional(),
        occupancyRate: z.number().min(0).max(100).optional()
    })
});

/**
 * Type exports for TypeScript
 */
export type AccommodationListItem = z.infer<typeof AccommodationListItemSchema>;
export type AccommodationDetail = z.infer<typeof AccommodationDetailSchema>;
export type AccommodationWithTags = z.infer<typeof AccommodationWithTagsSchema>;
export type AccommodationSummary = z.infer<typeof AccommodationSummarySchema>;
export type AccommodationStats = z.infer<typeof AccommodationStatsSchema>;
