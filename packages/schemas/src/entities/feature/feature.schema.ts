import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { i18nText } from '../../common/i18n.schema.js';
import { AccommodationIdSchema, FeatureIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { ApplicableVerticalSchema } from '../amenity/amenity.schema.js';

/**
 * Feature Schema - Main Entity Schema
 *
 * This schema represents a feature entity that can be associated with accommodations.
 * Features are stored in a separate table and linked via r_accommodation_feature.
 */
export const FeatureSchema = z.object({
    // Base fields
    id: FeatureIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Feature-specific fields
    slug: z
        .string({
            message: 'zodError.feature.slug.required'
        })
        .min(3, { message: 'zodError.feature.slug.min' })
        .max(100, { message: 'zodError.feature.slug.max' })
        .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/, {
            message: 'zodError.feature.slug.pattern'
        }),

    description: i18nText({ min: 10, max: 500 }).nullish(),

    /**
     * Verticals this feature is applicable to (SPEC-266).
     * At least one vertical required. NOT NULL in DB.
     */
    applicableVerticals: z
        .array(ApplicableVerticalSchema, {
            message: 'zodError.feature.applicableVerticals.required'
        })
        .min(1, { message: 'zodError.feature.applicableVerticals.min' }),

    icon: z
        .string({
            message: 'zodError.feature.icon.required'
        })
        .min(1, { message: 'zodError.feature.icon.min' })
        .max(100, { message: 'zodError.feature.icon.max' })
        .nullish(),

    isBuiltin: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    displayWeight: z
        .number({ message: 'zodError.feature.displayWeight.required' })
        .int({ message: 'zodError.feature.displayWeight.int' })
        .min(1, { message: 'zodError.feature.displayWeight.min' })
        .max(100, { message: 'zodError.feature.displayWeight.max' })
        .default(50)
});

/**
 * Accommodation-Feature Relation Schema
 * Represents the many-to-many relationship between accommodations and features
 */
export const AccommodationFeatureRelationSchema = z.object({
    accommodationId: AccommodationIdSchema,
    featureId: FeatureIdSchema,
    hostReWriteName: z
        .string()
        .min(3, { message: 'zodError.accommodationFeature.hostReWriteName.min' })
        .max(100, { message: 'zodError.accommodationFeature.hostReWriteName.max' })
        .optional(),
    comments: z
        .string()
        .min(5, { message: 'zodError.accommodationFeature.comments.min' })
        .max(300, { message: 'zodError.accommodationFeature.comments.max' })
        .optional()
});

/**
 * Type exports for the main Feature entity
 */
export type Feature = z.infer<typeof FeatureSchema>;
export type AccommodationFeatureRelation = z.infer<typeof AccommodationFeatureRelationSchema>;

/**
 * Gastronomy-Feature Relation Schema
 * Represents the many-to-many relationship between gastronomy listings and features.
 * Mirrors the accommodation variant with gastronomyId instead of accommodationId.
 */
export const GastronomyFeatureRelationSchema = z.object({
    gastronomyId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    featureId: FeatureIdSchema,
    hostReWriteName: z
        .string()
        .min(3, { message: 'zodError.gastronomyFeature.hostReWriteName.min' })
        .max(100, { message: 'zodError.gastronomyFeature.hostReWriteName.max' })
        .optional(),
    comments: z
        .string()
        .min(5, { message: 'zodError.gastronomyFeature.comments.min' })
        .max(300, { message: 'zodError.gastronomyFeature.comments.max' })
        .optional()
});
export type GastronomyFeatureRelation = z.infer<typeof GastronomyFeatureRelationSchema>;

/**
 * Experience-Feature Relation Schema (SPEC-240)
 * Represents the many-to-many relationship between experience listings and features.
 * Mirrors GastronomyFeatureRelationSchema with experienceId instead of gastronomyId.
 */
export const ExperienceFeatureRelationSchema = z.object({
    experienceId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
    featureId: FeatureIdSchema,
    hostReWriteName: z
        .string()
        .min(3, { message: 'zodError.experienceFeature.hostReWriteName.min' })
        .max(100, { message: 'zodError.experienceFeature.hostReWriteName.max' })
        .optional(),
    comments: z
        .string()
        .min(5, { message: 'zodError.experienceFeature.comments.min' })
        .max(300, { message: 'zodError.experienceFeature.comments.max' })
        .optional()
});
export type ExperienceFeatureRelation = z.infer<typeof ExperienceFeatureRelationSchema>;
