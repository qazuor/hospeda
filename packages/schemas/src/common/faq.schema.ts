import { z } from 'zod';
import { BaseAdminFields } from './admin.schema.js';
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
    ...BaseAdminFields,

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

/**
 * Type exports for FAQ schemas
 */
export type BaseFaq = z.infer<typeof BaseFaqSchema>;
