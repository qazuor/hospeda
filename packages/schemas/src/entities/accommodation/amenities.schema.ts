import { z } from 'zod';
import { BaseEntitySchema, BasePriceSchema } from '../../common.schema.js';
import { AmenitiesTypeEnumSchema } from '../../enums.schema.js';

/**
 * Zod schema for a accommodation amenities entity.
 */
export const AccommodationAmenitiesSchema = BaseEntitySchema.extend({
    description: z
        .string()
        .min(10, 'error:accommodation.amenity.content.min_lenght')
        .max(150, 'error:accommodation.amenity.content.max_lenght')
        .optional(),
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    icon: z.string().min(1, 'error:accommodation.amenity.icon.min_lenght').optional(),
    isBuiltin: z.boolean({
        required_error: 'error:accommodation.amenity.isBuiltin.required',
        invalid_type_error: 'error:accommodation.amenity.isBuiltin.invalid_type'
    }),
    isOptional: z.boolean({
        required_error: 'error:accommodation.amenity.isOptional.required',
        invalid_type_error: 'error:accommodation.amenity.isOptional.invalid_type'
    }),
    additionalCost: BasePriceSchema.optional(),
    additionalCostPercent: z
        .number()
        .min(1, 'error:accommodation.amenity.additionalCostPercent.min_lenght')
        .max(100, 'error:accommodation.amenity.additionalCostPercent.max_lenght')
        .optional(),
    type: AmenitiesTypeEnumSchema
});

export type AccommodationAmenitiesInput = z.infer<typeof AccommodationAmenitiesSchema>;
