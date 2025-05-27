import { z } from 'zod';
import { AmenityTypeEnumSchema } from '../../enums/amenity-type.enum.schema';
import { AmenitySchema } from './amenity.schema';

// Inputs para Amenity
export const NewAmenityInputSchema = AmenitySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true
});
export const UpdateAmenityInputSchema = NewAmenityInputSchema.partial();

// Filtros y ordenamiento
export const AmenityFilterInputSchema = z.object({
    name: z
        .string()
        .min(3, { message: 'zodError.amenity.name.min' })
        .max(100, { message: 'zodError.amenity.name.max' })
        .optional(),
    type: AmenityTypeEnumSchema.optional(),
    isBuiltin: z.boolean().optional(),
    q: z.string().optional()
});

export const AmenitySortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'type']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});

// Extras
export const AmenitySummarySchema = z.object({
    id: z.string(),
    name: z
        .string()
        .min(3, { message: 'zodError.amenity.name.min' })
        .max(100, { message: 'zodError.amenity.name.max' }),
    type: AmenityTypeEnumSchema,
    icon: z
        .string()
        .min(2, { message: 'zodError.amenity.icon.min' })
        .max(100, { message: 'zodError.amenity.icon.max' })
        .optional()
});
