import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSoftDeleteSchema
} from '../../common/helpers.schema';

export const FeatureSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        name: z
            .string()
            .min(3, { message: 'zodError.feature.name.min' })
            .max(100, { message: 'zodError.feature.name.max' }),
        description: z
            .string()
            .min(10, { message: 'zodError.feature.description.min' })
            .max(300, { message: 'zodError.feature.description.max' })
            .optional(),
        icon: z
            .string()
            .min(2, { message: 'zodError.feature.icon.min' })
            .max(100, { message: 'zodError.feature.icon.max' })
            .optional(),
        isBuiltin: z.boolean({ required_error: 'zodError.feature.isBuiltin.required' })
    });
