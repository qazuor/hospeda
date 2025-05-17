import { z } from 'zod';
import { BaseEntitySchema, BasePriceSchema } from '../common.schema.js';
import { AmenitiesTypeEnumSchema } from '../enums.schema.js';

/**
 * Zod schema for an amenity entity.
 */
export const AmenitySchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(10, 'error:amenity.description.min_lenght')
        .max(150, 'error:amenity.description.max_lenght')
        .optional(),
    icon: z.string().min(1, 'error:amenity.icon.min_lenght').optional(),
    isBuiltin: z.boolean({
        required_error: 'error:amenity.isBuiltin.required',
        invalid_type_error: 'error:amenity.isBuiltin.invalid_type'
    }),
    type: AmenitiesTypeEnumSchema
});

export type AmenityInput = z.infer<typeof AmenitySchema>;

/**
 * Zod schema for the relationship between accommodation and amenity.
 */
export const AccommodationAmenitySchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_amenity.accommodationId.invalid' }),
    amenityId: z.string().uuid({ message: 'error:accommodation_amenity.amenityId.invalid' }),
    isOptional: z.boolean({
        required_error: 'error:accommodation_amenity.isOptional.required',
        invalid_type_error: 'error:accommodation_amenity.isOptional.invalid_type'
    }),
    additionalCost: BasePriceSchema.optional().nullable(),
    additionalCostPercent: z.number().min(0).max(100).nullable().optional(),
    state: z.string().optional(),
    adminInfo: z
        .object({
            notes: z.string().optional(),
            favorite: z.boolean()
        })
        .optional()
});

export type AccommodationAmenityInput = z.infer<typeof AccommodationAmenitySchema>;
