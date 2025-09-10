import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AttractionIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * Attraction Schema - Main entity schema for attractions
 *
 * Represents an attraction that can be associated with destinations.
 * Attractions are points of interest, activities, or places that visitors can enjoy.
 */
export const AttractionSchema = z.object({
    // Base fields
    id: AttractionIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Attraction-specific fields
    name: z
        .string({
            message: 'zodError.attraction.name.required'
        })
        .min(3, { message: 'zodError.attraction.name.min' })
        .max(100, { message: 'zodError.attraction.name.max' }),

    slug: z
        .string({
            message: 'zodError.attraction.slug.required'
        })
        .min(3, { message: 'zodError.attraction.slug.min' })
        .max(100, { message: 'zodError.attraction.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.attraction.slug.pattern'
        })
        .optional(),

    description: z
        .string({
            message: 'zodError.attraction.description.required'
        })
        .min(10, { message: 'zodError.attraction.description.min' })
        .max(500, { message: 'zodError.attraction.description.max' }),

    icon: z
        .string({
            message: 'zodError.attraction.icon.required'
        })
        .min(1, { message: 'zodError.attraction.icon.min' })
        .max(100, { message: 'zodError.attraction.icon.max' }),

    destinationId: DestinationIdSchema.optional(),

    isFeatured: z.boolean().default(false),

    isBuiltin: z.boolean().default(false)
});

/**
 * Attraction Summary Schema - Lightweight version for lists and relations
 * Contains only essential fields for display purposes
 */
export const AttractionSummarySchema = AttractionSchema.pick({
    id: true,
    name: true,
    slug: true,
    description: true,
    icon: true,
    isFeatured: true,
    isBuiltin: true
});

/**
 * Attraction Mini Schema - Minimal version for dropdowns and references
 * Contains only the most basic identifying information
 */
export const AttractionMiniSchema = AttractionSchema.pick({
    id: true,
    name: true,
    slug: true,
    icon: true
});

/**
 * Type exports
 */
export type Attraction = z.infer<typeof AttractionSchema>;
export type AttractionSummary = z.infer<typeof AttractionSummarySchema>;
export type AttractionMini = z.infer<typeof AttractionMiniSchema>;
