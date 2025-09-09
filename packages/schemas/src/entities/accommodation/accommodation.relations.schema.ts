import { z } from 'zod';
import { AccommodationSchema } from './accommodation.schema.js';

/**
 * Accommodation Relations Schemas
 *
 * This file contains schemas for accommodations with related entities:
 * - AccommodationWithDestination
 * - AccommodationWithOwner
 * - AccommodationWithReviews
 * - AccommodationWithFeatures
 * - AccommodationWithAmenities
 * - AccommodationWithFull (all relations)
 */

// Import related schemas (these will be created later)
// For now, we'll define basic summary schemas inline to avoid circular dependencies

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Destination summary schema for relations
 * Contains essential destination information
 */
const DestinationSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    summary: z.string(),
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
    isFeatured: z.boolean(),
    accommodationsCount: z.number().int().min(0)
});

/**
 * User summary schema for relations
 * Contains essential user information (owner)
 */
const UserSummarySchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.string(),
    isActive: z.boolean()
});

/**
 * Review summary schema for relations
 * Contains essential review information
 */
const ReviewSummarySchema = z.object({
    id: z.string().uuid(),
    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    comment: z.string().optional(),
    userId: z.string().uuid(),
    userName: z.string().optional(),
    createdAt: z.date(),
    isVerified: z.boolean().optional()
});

/**
 * Feature summary schema for relations
 * Contains essential feature information
 */
const FeatureSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional()
});

/**
 * Amenity summary schema for relations
 * Contains essential amenity information
 */
const AmenitySummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    category: z.string().optional()
});

// ============================================================================
// ACCOMMODATION WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Accommodation with destination information
 * Includes the related destination data
 */
export const AccommodationWithDestinationSchema = AccommodationSchema.extend({
    destination: DestinationSummarySchema.optional()
});

/**
 * Accommodation with owner information
 * Includes the related user (owner) data
 */
export const AccommodationWithOwnerSchema = AccommodationSchema.extend({
    owner: UserSummarySchema.optional()
});

/**
 * Accommodation with reviews
 * Includes an array of related reviews
 */
export const AccommodationWithReviewsSchema = AccommodationSchema.extend({
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});

/**
 * Accommodation with features
 * Includes an array of related features with additional info
 */
export const AccommodationWithFeaturesSchema = AccommodationSchema.extend({
    features: z
        .array(
            FeatureSummarySchema.extend({
                // Additional fields specific to accommodation-feature relation
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional()
});

/**
 * Accommodation with amenities
 * Includes an array of related amenities with additional info
 */
export const AccommodationWithAmenitiesSchema = AccommodationSchema.extend({
    amenities: z
        .array(
            AmenitySummarySchema.extend({
                // Additional fields specific to accommodation-amenity relation
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional()
});

/**
 * Accommodation with basic relations
 * Includes destination and owner
 */
export const AccommodationWithBasicRelationsSchema = AccommodationSchema.extend({
    destination: DestinationSummarySchema.optional(),
    owner: UserSummarySchema.optional()
});

/**
 * Accommodation with content relations
 * Includes features, amenities, and reviews
 */
export const AccommodationWithContentRelationsSchema = AccommodationSchema.extend({
    features: z
        .array(
            FeatureSummarySchema.extend({
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional(),
    amenities: z
        .array(
            AmenitySummarySchema.extend({
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional(),
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});

/**
 * Accommodation with all relations
 * Includes all possible related entities
 */
export const AccommodationWithFullRelationsSchema = AccommodationSchema.extend({
    // Basic relations
    destination: DestinationSummarySchema.optional(),
    owner: UserSummarySchema.optional(),

    // Content relations
    features: z
        .array(
            FeatureSummarySchema.extend({
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional(),
    amenities: z
        .array(
            AmenitySummarySchema.extend({
                isOptional: z.boolean().optional(),
                additionalCost: z
                    .object({
                        amount: z.number().min(0),
                        currency: z.string()
                    })
                    .optional(),
                additionalCostPercent: z.number().min(0).max(100).optional()
            })
        )
        .optional(),

    // Review relations
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type AccommodationWithDestination = z.infer<typeof AccommodationWithDestinationSchema>;
export type AccommodationWithOwner = z.infer<typeof AccommodationWithOwnerSchema>;
export type AccommodationWithReviews = z.infer<typeof AccommodationWithReviewsSchema>;
export type AccommodationWithFeatures = z.infer<typeof AccommodationWithFeaturesSchema>;
export type AccommodationWithAmenities = z.infer<typeof AccommodationWithAmenitiesSchema>;
export type AccommodationWithBasicRelations = z.infer<typeof AccommodationWithBasicRelationsSchema>;
export type AccommodationWithContentRelations = z.infer<
    typeof AccommodationWithContentRelationsSchema
>;
export type AccommodationWithFullRelations = z.infer<typeof AccommodationWithFullRelationsSchema>;
