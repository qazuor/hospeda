import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
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

    name: z
        .string({
            message: 'zodError.feature.name.required'
        })
        .min(2, { message: 'zodError.feature.name.min' })
        .max(100, { message: 'zodError.feature.name.max' }),

    description: z
        .string({
            message: 'zodError.feature.description.required'
        })
        .min(10, { message: 'zodError.feature.description.min' })
        .max(500, { message: 'zodError.feature.description.max' })
        .optional(),

    icon: z
        .string({
            message: 'zodError.feature.icon.required'
        })
        .min(2, { message: 'zodError.feature.icon.min' })
        .max(100, { message: 'zodError.feature.icon.max' })
        .optional(),

    isBuiltin: z.boolean().default(false),
    isFeatured: z.boolean().default(false)
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
