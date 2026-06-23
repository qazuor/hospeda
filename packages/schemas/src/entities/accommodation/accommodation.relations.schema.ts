import { z } from 'zod';
import { createAverageRatingField } from '../../common/helpers.schema.js';
import { DestinationSummarySchema } from '../destination/destination.query.schema.js';
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
 * Simplified destination schema for basic API responses
 * Contains only essential destination information
 */
export const SimplifiedDestinationSchema = z.object({
    name: z.string(),
    slug: z.string()
});
export type SimplifiedDestination = z.infer<typeof SimplifiedDestinationSchema>;

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
    // SPEC-266: `name` column dropped; `slug` is the canonical id and i18n key.
    slug: z.string(),
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
    // SPEC-266: `name` column dropped; `slug` is the canonical id and i18n key.
    slug: z.string(),
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
export type AccommodationWithDestination = z.infer<typeof AccommodationWithDestinationSchema>;

/**
 * Accommodation with owner information
 * Includes the related user (owner) data
 */
export const AccommodationWithOwnerSchema = AccommodationSchema.extend({
    owner: UserSummarySchema.optional()
});
export type AccommodationWithOwner = z.infer<typeof AccommodationWithOwnerSchema>;

/**
 * Accommodation with reviews
 * Includes an array of related reviews
 */
export const AccommodationWithReviewsSchema = AccommodationSchema.extend({
    reviews: z.array(ReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: createAverageRatingField({ optional: true })
});
export type AccommodationWithReviews = z.infer<typeof AccommodationWithReviewsSchema>;

/**
 * Accommodation with features
 * Includes an array of related features with junction data.
 *
 * NOTE: r_accommodation_feature only carries hostReWriteName and comments.
 * There are NO isOptional / additionalCost / additionalCostPercent columns on
 * this junction (those exist only on r_accommodation_amenity). Do not add
 * phantom junction fields here — hostReWriteName/comments are intentionally
 * not exposed in the read schema yet (pending SPEC-172 Phase 3).
 */
export const AccommodationWithFeaturesSchema = AccommodationSchema.extend({
    features: z.array(FeatureSummarySchema).optional()
});
export type AccommodationWithFeatures = z.infer<typeof AccommodationWithFeaturesSchema>;

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
export type AccommodationWithAmenities = z.infer<typeof AccommodationWithAmenitiesSchema>;

/**
 * Accommodation with basic relations
 * Includes destination and owner
 */
export const AccommodationWithBasicRelationsSchema = AccommodationSchema.extend({
    destination: DestinationSummarySchema.optional(),
    owner: UserSummarySchema.optional()
});
export type AccommodationWithBasicRelations = z.infer<typeof AccommodationWithBasicRelationsSchema>;

/**
 * Accommodation with content relations
 * Includes features, amenities, and reviews.
 *
 * NOTE: r_accommodation_feature carries only hostReWriteName/comments (no
 * isOptional / additionalCost / additionalCostPercent). Those three fields
 * only exist on r_accommodation_amenity and are kept there intentionally.
 */
export const AccommodationWithContentRelationsSchema = AccommodationSchema.extend({
    // r_accommodation_feature: no pricing phantom fields — see NOTE above
    features: z.array(FeatureSummarySchema).optional(),
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
    averageRating: createAverageRatingField({ optional: true })
});
export type AccommodationWithContentRelations = z.infer<
    typeof AccommodationWithContentRelationsSchema
>;

/**
 * Accommodation with all relations
 * Includes all possible related entities.
 *
 * NOTE: r_accommodation_feature carries only hostReWriteName/comments (no
 * isOptional / additionalCost / additionalCostPercent). Those three fields
 * only exist on r_accommodation_amenity and are kept there intentionally.
 */
export const AccommodationWithFullRelationsSchema = AccommodationSchema.extend({
    // Basic relations
    destination: DestinationSummarySchema.optional(),
    owner: UserSummarySchema.optional(),

    // Content relations — r_accommodation_feature: no pricing phantom fields
    features: z.array(FeatureSummarySchema).optional(),
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
    averageRating: createAverageRatingField({ optional: true })
});
export type AccommodationWithFullRelations = z.infer<typeof AccommodationWithFullRelationsSchema>;

// ============================================================================
// NORMALIZED TYPES FOR API RESPONSES
// ============================================================================

/**
 * Normalized accommodation schema for API responses
 * Similar to Accommodation but with simplified relationships
 */
export const NormalizedAccommodationSchema = AccommodationSchema.extend({
    amenities: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
    destination: SimplifiedDestinationSchema.optional()
});
export type NormalizedAccommodationType = z.infer<typeof NormalizedAccommodationSchema>;

/**
 * Accommodation with relations type for database operations
 * Used by normalizers that may receive objects with relations
 */
export const AccommodationWithRelationsSchema = AccommodationSchema.extend({
    amenities: z
        .union([
            z.array(z.object({ amenity: z.object({ slug: z.string().optional() }).optional() })),
            z.array(z.string())
        ])
        .optional(),
    features: z
        .union([
            z.array(z.object({ feature: z.object({ slug: z.string().optional() }).optional() })),
            z.array(z.string())
        ])
        .optional(),
    destination: z
        .object({
            name: z.string().optional(),
            slug: z.string().optional()
        })
        .nullable()
        .optional()
});
export type AccommodationWithRelations = z.infer<typeof AccommodationWithRelationsSchema>;
