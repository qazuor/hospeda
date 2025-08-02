import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common/index.js';

/**
 * Accommodation FAQ schema definition using Zod for validation.
 * Represents a frequently asked question for an accommodation.
 */
export const AccommodationFaqSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        accommodationId: z.string({
            message: 'zodError.accommodation.faq.accommodationId.required'
        }),
        question: z
            .string({
                message: 'zodError.accommodation.faq.question.required'
            })
            .min(5, { message: 'zodError.accommodation.faq.question.min' })
            .max(200, { message: 'zodError.accommodation.faq.question.max' }),
        answer: z
            .string({
                message: 'zodError.accommodation.faq.answer.required'
            })
            .min(5, { message: 'zodError.accommodation.faq.answer.min' })
            .max(2000, { message: 'zodError.accommodation.faq.answer.max' }),
        category: z
            .string({
                message: 'zodError.accommodation.faq.category.required'
            })
            .min(2, { message: 'zodError.accommodation.faq.category.min' })
            .max(50, { message: 'zodError.accommodation.faq.category.max' })
            .optional()
    });
