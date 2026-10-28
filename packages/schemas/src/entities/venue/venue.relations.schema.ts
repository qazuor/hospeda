import { z } from 'zod';
import { VenueSchema } from './venue.schema.js';

/**
 * Gastronomy Relations Schemas
 *
 * This file contains schemas for gastronomy listings with related entities:
 * - GastronomyWithDestination
 * - GastronomyWithOwner
 * - GastronomyWithReviews
 * - GastronomyWithAmenities
 * - GastronomyWithFeatures
 * - GastronomyWithFullRelations
 */

// ============================================================================
// RELATED ENTITY SUMMARY SCHEMAS
// ============================================================================

/**
 * Simplified destination schema for basic API responses.
 */
const DestinationMiniSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string()
});

/**
 * User summary schema for relations (owner).
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
 * Review summary schema for gastronomy relations.
 */
const VenueReviewSummarySchema = z.object({
    id: z.string().uuid(),
    overallRating: z.number().min(1).max(5),
    comment: z.string().optional(),
    userId: z.string().uuid(),
    userName: z.string().optional(),
    createdAt: z.date()
});

/**
 * Feature summary schema for relations.
 */
const FeatureSummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.unknown().optional(), // i18nText
    icon: z.string().optional()
});

/**
 * Amenity summary schema for relations.
 */
const AmenitySummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.unknown().optional(), // i18nText
    icon: z.string().optional()
});

// ============================================================================
// GASTRONOMY WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Gastronomy with destination information.
 */
export const VenueWithDestinationSchema = VenueSchema.extend({
    destination: DestinationMiniSchema.optional()
});
export type VenueWithDestination = z.infer<typeof VenueWithDestinationSchema>;

/**
 * Gastronomy with owner information.
 */
export const VenueWithOwnerSchema = VenueSchema.extend({
    owner: UserSummarySchema.optional()
});
export type VenueWithOwner = z.infer<typeof VenueWithOwnerSchema>;

/**
 * Gastronomy with reviews array.
 */
export const VenueWithReviewsSchema = VenueSchema.extend({
    reviews: z.array(VenueReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type VenueWithReviews = z.infer<typeof VenueWithReviewsSchema>;

/**
 * Gastronomy with features array.
 */
export const VenueWithFeaturesSchema = VenueSchema.extend({
    features: z.array(FeatureSummarySchema).optional()
});
export type VenueWithFeatures = z.infer<typeof VenueWithFeaturesSchema>;

/**
 * Gastronomy with amenities array.
 */
export const VenueWithAmenitiesSchema = VenueSchema.extend({
    amenities: z.array(AmenitySummarySchema).optional()
});
export type VenueWithAmenities = z.infer<typeof VenueWithAmenitiesSchema>;

/**
 * Gastronomy with basic relations (destination + owner).
 */
export const VenueWithBasicRelationsSchema = VenueSchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional()
});
export type VenueWithBasicRelations = z.infer<typeof VenueWithBasicRelationsSchema>;

/**
 * Gastronomy with all relations.
 */
export const VenueWithFullRelationsSchema = VenueSchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional(),
    features: z.array(FeatureSummarySchema).optional(),
    amenities: z.array(AmenitySummarySchema).optional(),
    reviews: z.array(VenueReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type VenueWithFullRelations = z.infer<typeof VenueWithFullRelationsSchema>;
