import { z } from 'zod';
import { GastronomySchema } from './gastronomy.schema.js';

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
const GastronomyReviewSummarySchema = z.object({
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
    name: z.unknown(), // i18nText
    icon: z.string().optional()
});

/**
 * Amenity summary schema for relations.
 */
const AmenitySummarySchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.unknown(), // i18nText
    icon: z.string().optional()
});

// ============================================================================
// GASTRONOMY WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Gastronomy with destination information.
 */
export const GastronomyWithDestinationSchema = GastronomySchema.extend({
    destination: DestinationMiniSchema.optional()
});
export type GastronomyWithDestination = z.infer<typeof GastronomyWithDestinationSchema>;

/**
 * Gastronomy with owner information.
 */
export const GastronomyWithOwnerSchema = GastronomySchema.extend({
    owner: UserSummarySchema.optional()
});
export type GastronomyWithOwner = z.infer<typeof GastronomyWithOwnerSchema>;

/**
 * Gastronomy with reviews array.
 */
export const GastronomyWithReviewsSchema = GastronomySchema.extend({
    reviews: z.array(GastronomyReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type GastronomyWithReviews = z.infer<typeof GastronomyWithReviewsSchema>;

/**
 * Gastronomy with features array.
 */
export const GastronomyWithFeaturesSchema = GastronomySchema.extend({
    features: z.array(FeatureSummarySchema).optional()
});
export type GastronomyWithFeatures = z.infer<typeof GastronomyWithFeaturesSchema>;

/**
 * Gastronomy with amenities array.
 */
export const GastronomyWithAmenitiesSchema = GastronomySchema.extend({
    amenities: z.array(AmenitySummarySchema).optional()
});
export type GastronomyWithAmenities = z.infer<typeof GastronomyWithAmenitiesSchema>;

/**
 * Gastronomy with basic relations (destination + owner).
 */
export const GastronomyWithBasicRelationsSchema = GastronomySchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional()
});
export type GastronomyWithBasicRelations = z.infer<typeof GastronomyWithBasicRelationsSchema>;

/**
 * Gastronomy with all relations.
 */
export const GastronomyWithFullRelationsSchema = GastronomySchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional(),
    features: z.array(FeatureSummarySchema).optional(),
    amenities: z.array(AmenitySummarySchema).optional(),
    reviews: z.array(GastronomyReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type GastronomyWithFullRelations = z.infer<typeof GastronomyWithFullRelationsSchema>;
