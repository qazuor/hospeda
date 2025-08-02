import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';

/**
 * Accommodation AI Data schema definition using Zod for validation.
 * Represents AI-generated or related data for an accommodation.
 */
export const AccommodationIaDataSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        accommodationId: z.string({
            message: 'zodError.accommodation.ia.accommodationId.required'
        }),
        title: z
            .string({
                message: 'zodError.accommodation.ia.title.required'
            })
            .min(3, { message: 'zodError.accommodation.ia.title.min' })
            .max(100, { message: 'zodError.accommodation.ia.title.max' }),
        content: z
            .string({
                message: 'zodError.accommodation.ia.content.required'
            })
            .min(10, { message: 'zodError.accommodation.ia.content.min' })
            .max(2000, { message: 'zodError.accommodation.ia.content.max' }),
        category: z
            .string({
                message: 'zodError.accommodation.ia.category.required'
            })
            .min(2, { message: 'zodError.accommodation.ia.category.min' })
            .max(50, { message: 'zodError.accommodation.ia.category.max' })
            .optional()
    });
