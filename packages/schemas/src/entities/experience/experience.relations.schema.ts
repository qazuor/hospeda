import { z } from 'zod';
import { ExperienceSchema } from './experience.schema.js';

/**
 * Experience Relations Schemas
 *
 * This file contains schemas for experience listings with related entities:
 * - ExperienceWithDestination
 * - ExperienceWithOwner
 * - ExperienceWithReviews
 * - ExperienceWithAmenities
 * - ExperienceWithFeatures
 * - ExperienceWithFullRelations
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
 * Review summary schema for experience relations.
 */
const ExperienceReviewSummarySchema = z.object({
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
// EXPERIENCE WITH RELATIONS SCHEMAS
// ============================================================================

/**
 * Experience with destination information.
 */
export const ExperienceWithDestinationSchema = ExperienceSchema.extend({
    destination: DestinationMiniSchema.optional()
});
export type ExperienceWithDestination = z.infer<typeof ExperienceWithDestinationSchema>;

/**
 * Experience with owner information.
 */
export const ExperienceWithOwnerSchema = ExperienceSchema.extend({
    owner: UserSummarySchema.optional()
});
export type ExperienceWithOwner = z.infer<typeof ExperienceWithOwnerSchema>;

/**
 * Experience with reviews array.
 */
export const ExperienceWithReviewsSchema = ExperienceSchema.extend({
    reviews: z.array(ExperienceReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type ExperienceWithReviews = z.infer<typeof ExperienceWithReviewsSchema>;

/**
 * Experience with features array.
 */
export const ExperienceWithFeaturesSchema = ExperienceSchema.extend({
    features: z.array(FeatureSummarySchema).optional()
});
export type ExperienceWithFeatures = z.infer<typeof ExperienceWithFeaturesSchema>;

/**
 * Experience with amenities array.
 */
export const ExperienceWithAmenitiesSchema = ExperienceSchema.extend({
    amenities: z.array(AmenitySummarySchema).optional()
});
export type ExperienceWithAmenities = z.infer<typeof ExperienceWithAmenitiesSchema>;

/**
 * Experience with basic relations (destination + owner).
 */
export const ExperienceWithBasicRelationsSchema = ExperienceSchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional()
});
export type ExperienceWithBasicRelations = z.infer<typeof ExperienceWithBasicRelationsSchema>;

/**
 * Experience with all relations.
 */
export const ExperienceWithFullRelationsSchema = ExperienceSchema.extend({
    destination: DestinationMiniSchema.optional(),
    owner: UserSummarySchema.optional(),
    features: z.array(FeatureSummarySchema).optional(),
    amenities: z.array(AmenitySummarySchema).optional(),
    reviews: z.array(ExperienceReviewSummarySchema).optional(),
    reviewsCount: z.number().int().min(0).optional(),
    averageRating: z.number().min(0).max(5).optional()
});
export type ExperienceWithFullRelations = z.infer<typeof ExperienceWithFullRelationsSchema>;
