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
            required_error: 'zodError.accommodation.ia.accommodationId.required',
            invalid_type_error: 'zodError.accommodation.ia.accommodationId.invalidType'
        }),
        title: z
            .string({
                required_error: 'zodError.accommodation.ia.title.required',
                invalid_type_error: 'zodError.accommodation.ia.title.invalidType'
            })
            .min(3, { message: 'zodError.accommodation.ia.title.min' })
            .max(100, { message: 'zodError.accommodation.ia.title.max' }),
        content: z
            .string({
                required_error: 'zodError.accommodation.ia.content.required',
                invalid_type_error: 'zodError.accommodation.ia.content.invalidType'
            })
            .min(10, { message: 'zodError.accommodation.ia.content.min' })
            .max(2000, { message: 'zodError.accommodation.ia.content.max' }),
        category: z
            .string({
                required_error: 'zodError.accommodation.ia.category.required',
                invalid_type_error: 'zodError.accommodation.ia.category.invalidType'
            })
            .min(2, { message: 'zodError.accommodation.ia.category.min' })
            .max(50, { message: 'zodError.accommodation.ia.category.max' })
            .optional()
    });
