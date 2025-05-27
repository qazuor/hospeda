import { z } from 'zod';
import {
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema
} from '../../common';

/**
 * Accommodation FAQ schema definition using Zod for validation.
 * Represents a frequently asked question for an accommodation.
 */
export const AccommodationFaqSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        accommodationId: z.string({
            required_error: 'zodError.accommodation.faq.accommodationId.required',
            invalid_type_error: 'zodError.accommodation.faq.accommodationId.invalidType'
        }),
        question: z
            .string({
                required_error: 'zodError.accommodation.faq.question.required',
                invalid_type_error: 'zodError.accommodation.faq.question.invalidType'
            })
            .min(5, { message: 'zodError.accommodation.faq.question.min' })
            .max(200, { message: 'zodError.accommodation.faq.question.max' }),
        answer: z
            .string({
                required_error: 'zodError.accommodation.faq.answer.required',
                invalid_type_error: 'zodError.accommodation.faq.answer.invalidType'
            })
            .min(5, { message: 'zodError.accommodation.faq.answer.min' })
            .max(2000, { message: 'zodError.accommodation.faq.answer.max' }),
        category: z
            .string({
                required_error: 'zodError.accommodation.faq.category.required',
                invalid_type_error: 'zodError.accommodation.faq.category.invalidType'
            })
            .min(2, { message: 'zodError.accommodation.faq.category.min' })
            .max(50, { message: 'zodError.accommodation.faq.category.max' })
            .optional()
    });
