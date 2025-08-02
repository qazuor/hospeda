import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';

export const FeatureSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        name: z
            .string()
            .min(2, { message: 'zodError.feature.name.min' })
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
        isBuiltin: z.boolean({ message: 'zodError.feature.isBuiltin.required' }),
        slug: z
            .string()
            .min(3)
            .max(100)
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .optional(),
        isFeatured: z.boolean().optional().default(false)
    });
