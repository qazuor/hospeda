import { z } from 'zod';
import { BaseAuditFields } from './audit.schema.js';
import { BaseLifecycleFields } from './lifecycle.schema.js';

/**
 * Base FAQ Schema - Common structure for FAQ entries
 *
 * This schema can be extended by specific entities (accommodation, destination, etc.)
 * to create their own FAQ schemas with the appropriate ID field.
 */
export const BaseFaqSchema = z.object({
    // Base fields
    ...BaseAuditFields,
    ...BaseLifecycleFields,

    // FAQ-specific fields
    question: z
        .string({
            message: 'zodError.common.faq.question.required'
        })
        .min(10, { message: 'zodError.common.faq.question.min' })
        .max(300, { message: 'zodError.common.faq.question.max' }),

    answer: z
        .string({
            message: 'zodError.common.faq.answer.required'
        })
        .min(10, { message: 'zodError.common.faq.answer.min' })
        .max(2000, { message: 'zodError.common.faq.answer.max' }),

    category: z
        .string({
            message: 'zodError.common.faq.category.required'
        })
        .min(2, { message: 'zodError.common.faq.category.min' })
        .max(100, { message: 'zodError.common.faq.category.max' })
        .optional()
});
export type BaseFaqType = z.infer<typeof BaseFaqSchema>;

/**
 * FAQ creation payload schema: only the core FAQ fields without audit/lifecycle fields
 */
export const FaqCreatePayloadSchema = BaseFaqSchema.pick({
    question: true,
    answer: true,
    category: true
});
export type FaqCreatePayloadType = z.infer<typeof FaqCreatePayloadSchema>;

/**
 * FAQ update payload schema: partial of the create payload
 */
export const FaqUpdatePayloadSchema = FaqCreatePayloadSchema.partial();
export type FaqUpdatePayloadType = z.infer<typeof FaqUpdatePayloadSchema>;

/**
 * FAQ fields (using BaseFaqSchema structure)
 */
export const FaqFields = {
    faq: BaseFaqSchema.optional()
} as const;
export type FaqFieldsType = typeof FaqFields;
