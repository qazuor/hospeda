import type { AccommodationAmenitiesType } from '@repo/types';
import { AmenitiesTypeEnum } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema, BasePriceSchema } from '../common.schema';

/**
 * Zod schema for accommodation amenity.
 */
export const AccommodationAmenitiesSchema: z.ZodType<AccommodationAmenitiesType> =
    BaseEntitySchema.extend({
        accommodationId: z.string().uuid({
            message: 'error:accommodationAmenity.accommodationIdInvalid'
        }),
        description: z.string().optional(),
        icon: z.string({ required_error: 'error:accommodationAmenity.iconRequired' }).optional(),
        isBuiltin: z.boolean({ required_error: 'error:accommodationAmenity.isBuiltinRequired' }),
        isOptional: z.boolean({ required_error: 'error:accommodationAmenity.isOptionalRequired' }),
        additionalCost: BasePriceSchema.optional(),
        additionalCostPercent: z.number().min(0).max(100).optional(),
        type: z
            .nativeEnum(AmenitiesTypeEnum, {
                required_error: 'error:accommodationAmenity.typeRequired',
                invalid_type_error: 'error:accommodationAmenity.typeInvalid'
            })
            .optional()
    });
