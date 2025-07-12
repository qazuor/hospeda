import { z } from 'zod';
import { WithAdminInfoSchema } from '../../common/index.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';

/**
 * Destination Attraction schema definition using Zod for validation.
 * Represents an attraction associated with a destination.
 */
export const DestinationAttractionSchema = WithAdminInfoSchema.extend({
    name: z
        .string()
        .min(3, { message: 'error:destination.attraction.name.min_length' })
        .max(30, { message: 'error:destination.attraction.name.max_length' }),
    slug: z
        .string()
        .min(3, { message: 'error:destination.attraction.slug.min_length' })
        .max(30, { message: 'error:destination.attraction.slug.max_length' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'error:destination.attraction.slug.pattern'
        }),
    description: z
        .string()
        .min(10, { message: 'error:destination.attraction.description.min_length' })
        .max(100, { message: 'error:destination.attraction.description.max_length' }),
    icon: z.string().min(1, { message: 'error:destination.attraction.icon.min_length' }),
    destinationId: z.string({ message: 'error:destination.attraction.destinationId.required' }),
    isFeatured: z.boolean().optional().default(false),
    isBuiltin: z.boolean().optional().default(false)
}).strict();

/**
 * Schema for creating a new attraction.
 * Omits id and admin/audit fields. Permite 'slug' opcional.
 */
export const CreateAttractionSchema = DestinationAttractionSchema.omit({
    // id, createdAt, updatedAt, createdById, updatedById, deletedAt, deletedById, adminInfo are omitted by WithAdminInfoSchema
})
    .extend({
        slug: z
            .string()
            .min(3, { message: 'error:destination.attraction.slug.min_length' })
            .max(30, { message: 'error:destination.attraction.slug.max_length' })
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
                message: 'error:destination.attraction.slug.pattern'
            })
            .optional(),
        destinationId: z
            .string({ message: 'error:destination.attraction.destinationId.required' })
            .optional()
    })
    .strict();

/**
 * Schema for updating an attraction.
 * All fields optional except id.
 */
export const UpdateAttractionSchema = DestinationAttractionSchema.partial()
    .extend({
        id: z.string({ message: 'error:destination.attraction.id.required' }).optional()
    })
    .strict();

/**
 * Schema for searching attractions.
 * All fields optional, inside 'filters'.
 */
export const SearchAttractionSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            name: z.string().optional(),
            slug: z.string().optional(),
            isFeatured: z.boolean().optional(),
            isBuiltin: z.boolean().optional(),
            destinationId: z.string().optional()
        })
        .optional()
}).strict();

/**
 * Schema for adding an attraction to a destination.
 */
export const AddAttractionToDestinationInputSchema = z
    .object({
        destinationId: z.string({ message: 'error:destination.attraction.destinationId.required' }),
        attractionId: z.string({ message: 'error:destination.attraction.attractionId.required' })
    })
    .strict();

/**
 * Schema for removing an attraction from a destination.
 */
export const RemoveAttractionFromDestinationInputSchema = z
    .object({
        destinationId: z.string({ message: 'error:destination.attraction.destinationId.required' }),
        attractionId: z.string({ message: 'error:destination.attraction.attractionId.required' })
    })
    .strict();

/**
 * Schema for getting all attractions for a destination.
 */
export const GetAttractionsForDestinationSchema = z
    .object({
        destinationId: z.string({ message: 'error:destination.attraction.destinationId.required' })
    })
    .strict();

/**
 * Schema for getting all destinations by attraction.
 */
export const GetDestinationsByAttractionSchema = z
    .object({
        attractionId: z.string({ message: 'error:destination.attraction.attractionId.required' })
    })
    .strict();
