import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';
import { AmenityTypeEnumSchema } from '../../enums/amenity-type.enum.schema';

export const AmenitySchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        name: z
            .string()
            .min(3, { message: 'zodError.amenity.name.min' })
            .max(100, { message: 'zodError.amenity.name.max' }),
        description: z
            .string()
            .min(10, { message: 'zodError.amenity.description.min' })
            .max(300, { message: 'zodError.amenity.description.max' })
            .optional(),
        icon: z
            .string()
            .min(2, { message: 'zodError.amenity.icon.min' })
            .max(100, { message: 'zodError.amenity.icon.max' })
            .optional(),
        isBuiltin: z.boolean({ required_error: 'zodError.amenity.isBuiltin.required' }),
        type: AmenityTypeEnumSchema
    });
