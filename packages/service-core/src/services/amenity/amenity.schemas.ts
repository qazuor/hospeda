import { BaseSearchSchema } from '@repo/schemas';
import { z } from 'zod';

/**
 * Zod schema for creating a new amenity. Omits server-generated and audit fields.
 * Fields: name (min 3 chars), type, optional icon, optional description, optional isBuiltin, optional slug, optional isFeatured.
 */
// TODO: If a shared AmenitySchema exists, import it from the correct path and use it here.
export const CreateAmenitySchema = z
    .object({
        name: z.string().min(3),
        type: z.string(),
        icon: z.string().optional(),
        description: z.string().optional(),
        isBuiltin: z.boolean().optional(),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        isFeatured: z.boolean().optional().default(false)
    })
    .strict();
/**
 * Type for amenity creation input, inferred from CreateAmenitySchema.
 */
export type CreateAmenityInput = z.infer<typeof CreateAmenitySchema>;

/**
 * Zod schema for updating an amenity. All fields are optional (partial patch).
 */
export const UpdateAmenitySchema = CreateAmenitySchema.partial().strict();
/**
 * Type for amenity update input, inferred from UpdateAmenitySchema.
 */
export type UpdateAmenityInput = z.infer<typeof UpdateAmenitySchema>;

/**
 * Zod schema for searching/filtering amenities.
 * Extends BaseSearchSchema with optional filters (name, type).
 */
export const SearchAmenitySchema = BaseSearchSchema.extend({
    filters: z
        .object({
            name: z.string().optional(),
            type: z.string().optional()
        })
        .optional()
});
/**
 * Type for amenity search input, inferred from SearchAmenitySchema.
 */
export type SearchAmenityInput = z.infer<typeof SearchAmenitySchema>;

/**
 * Zod schema for adding an amenity to an accommodation.
 * Fields: accommodationId, amenityId, optional isOptional, optional additionalCost, optional additionalCostPercent (0-100).
 * TODO: If a price schema exists, use it for additionalCost instead of z.any().
 */
export const AddAmenityToAccommodationInputSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required'),
        amenityId: z.string().min(1, 'Amenity ID is required'),
        isOptional: z.boolean().optional(),
        additionalCost: z.any().optional(), // TODO: Replace z.any() with a price schema if available
        additionalCostPercent: z.number().min(0).max(100).optional()
    })
    .strict();

/**
 * Zod schema for removing an amenity from an accommodation.
 * Requires non-empty accommodationId and amenityId.
 */
export const RemoveAmenityFromAccommodationInputSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required'),
        amenityId: z.string().min(1, 'Amenity ID is required')
    })
    .strict();

/**
 * Zod schema for getting all amenities for a given accommodation.
 * Requires non-empty accommodationId.
 */
export const GetAmenitiesForAccommodationSchema = z
    .object({
        accommodationId: z.string().min(1, 'Accommodation ID is required')
    })
    .strict();

/**
 * Zod schema for getting all accommodations for a given amenity.
 * Requires non-empty amenityId.
 */
export const GetAccommodationsByAmenitySchema = z
    .object({
        amenityId: z.string().min(1, 'Amenity ID is required')
    })
    .strict();
