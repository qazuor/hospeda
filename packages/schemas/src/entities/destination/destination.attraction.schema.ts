import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { AttractionIdSchema, DestinationIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';

/**
 * Destination Attraction Schema - using Base Field Objects
 *
 * This schema represents an attraction associated with a destination.
 * Migrated from legacy WithAdminInfoSchema pattern to use base field objects.
 */
export const DestinationAttractionSchema = z.object({
    // Base fields
    id: AttractionIdSchema,
    ...BaseAuditFields,
    ...BaseLifecycleFields,
    ...BaseAdminFields,

    // Attraction-specific fields
    name: z
        .string()
        .min(3, { message: 'zodError.destination.attraction.name.min' })
        .max(100, { message: 'zodError.destination.attraction.name.max' }),
    slug: z
        .string()
        .min(3, { message: 'zodError.destination.attraction.slug.min' })
        .max(100, { message: 'zodError.destination.attraction.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.destination.attraction.slug.pattern'
        }),
    description: z
        .string()
        .min(10, { message: 'zodError.destination.attraction.description.min' })
        .max(500, { message: 'zodError.destination.attraction.description.max' }),
    icon: z
        .string()
        .min(1, { message: 'zodError.destination.attraction.icon.min' })
        .max(100, { message: 'zodError.destination.attraction.icon.max' }),
    destinationId: DestinationIdSchema,
    isFeatured: z.boolean().default(false),
    isBuiltin: z.boolean().default(false)
});

/**
 * Schema for creating a new attraction
 * Omits server-generated fields
 */
export const CreateAttractionSchema = DestinationAttractionSchema.omit({
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
        .min(3, { message: 'zodError.destination.attraction.slug.min' })
        .max(100, { message: 'zodError.destination.attraction.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.destination.attraction.slug.pattern'
        })
        .optional(),
    // Destination ID is optional on create (can be set later)
    destinationId: DestinationIdSchema.optional()
});

/**
 * Schema for updating an attraction
 * All fields are optional for partial updates
 */
export const UpdateAttractionSchema = CreateAttractionSchema.partial();

/**
 * Schema for searching attractions
 * Contains search criteria and filter options
 */
export const SearchAttractionSchema = z.object({
    filters: z
        .object({
            name: z.string().optional(),
            slug: z.string().optional(),
            isFeatured: z.boolean().optional(),
            isBuiltin: z.boolean().optional(),
            destinationId: DestinationIdSchema.optional(),
            lifecycleState: z.string().optional(),
            q: z.string().optional() // free text search
        })
        .optional(),
    pagination: z
        .object({
            page: z.number().int().min(1).default(1),
            pageSize: z.number().int().min(1).max(100).default(20)
        })
        .optional()
});

/**
 * Schema for adding an attraction to a destination
 */
export const AddAttractionToDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionId: AttractionIdSchema
});

/**
 * Schema for removing an attraction from a destination
 */
export const RemoveAttractionFromDestinationInputSchema = z.object({
    destinationId: DestinationIdSchema,
    attractionId: AttractionIdSchema
});

/**
 * Schema for getting all attractions for a destination
 */
export const GetAttractionsForDestinationSchema = z.object({
    destinationId: DestinationIdSchema
});

/**
 * Schema for getting all destinations by attraction
 */
export const GetDestinationsByAttractionSchema = z.object({
    attractionId: AttractionIdSchema
});

/**
 * Type exports
 */
export type DestinationAttraction = z.infer<typeof DestinationAttractionSchema>;
export type CreateAttraction = z.infer<typeof CreateAttractionSchema>;
export type UpdateAttraction = z.infer<typeof UpdateAttractionSchema>;
export type SearchAttraction = z.infer<typeof SearchAttractionSchema>;
export type AddAttractionToDestinationInput = z.infer<typeof AddAttractionToDestinationInputSchema>;
export type RemoveAttractionFromDestinationInput = z.infer<
    typeof RemoveAttractionFromDestinationInputSchema
>;
export type GetAttractionsForDestinationInput = z.infer<typeof GetAttractionsForDestinationSchema>;
export type GetDestinationsByAttractionInput = z.infer<typeof GetDestinationsByAttractionSchema>;
