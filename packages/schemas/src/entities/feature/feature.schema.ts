import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { i18nText } from '../../common/i18n.schema.js';
import { AccommodationIdSchema, FeatureIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

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
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.feature.slug.pattern'
        }),

    name: i18nText({ min: 2, max: 100 }),

    description: i18nText({ min: 10, max: 500 }).nullish(),

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
