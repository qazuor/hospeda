import { z } from 'zod';
import { FeatureSchema } from './feature.schema.js';

/**
 * Feature Operations Schemas
 *
 * This file contains all CRUD and operational schemas derived from
 * the main FeatureSchema for different use cases.
 */

/**
 * Schema for creating a new feature
 * Omits server-generated fields
 */
export const FeatureCreateSchema = FeatureSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    // Slug is optional on create (auto-generated from name)
    slug: z
        .string()
        .min(3)
        .max(100)
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional()
});

/**
 * Schema for updating an existing feature
 * All fields are optional for partial updates
 */
export const FeatureUpdateSchema = FeatureCreateSchema.partial();

/**
 * Schema for viewing feature details
 * Same as the main schema, used for clarity in API responses
 */
export const FeatureViewSchema = FeatureSchema;

/**
 * Schema for feature list items
 * Contains only essential fields for list displays
 */
export const FeatureListItemSchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    description: true,
    icon: true,
    isBuiltin: true,
    isFeatured: true,
    lifecycleState: true,
    createdAt: true,
    updatedAt: true
});

/**
 * Schema for feature search and filtering
 * Contains search criteria and filter options
 */
export const FeatureSearchSchema = z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isBuiltin: z.boolean().optional(),
    lifecycleState: z.string().optional()
});

/**
 * Schema for feature summary
 * Lightweight version for cards and previews
 */
export const FeatureSummarySchema = FeatureSchema.pick({
    id: true,
    slug: true,
    name: true,
    icon: true,
    isFeatured: true
});

/**
 * Type exports for all operation schemas
 */
export type FeatureCreate = z.infer<typeof FeatureCreateSchema>;
export type FeatureUpdate = z.infer<typeof FeatureUpdateSchema>;
export type FeatureView = z.infer<typeof FeatureViewSchema>;
export type FeatureListItem = z.infer<typeof FeatureListItemSchema>;
export type FeatureSearch = z.infer<typeof FeatureSearchSchema>;
export type FeatureSummary = z.infer<typeof FeatureSummarySchema>;
