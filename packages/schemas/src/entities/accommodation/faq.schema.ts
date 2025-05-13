import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema';

/**
 * Zod schema for a accommodation faq entity.
 */
export const AccommodationFaqSchema = BaseEntitySchema.extend({
    question: z
        .string()
        .min(5, 'error:accommodation.faq.question.min_lenght')
        .max(50, 'error:accommodation.faq.question.max_lenght'),
    answer: z
        .string()
        .min(1, 'error:accommodation.faq.answer.min_lenght')
        .max(200, 'error:accommodation.faq.answer.max_lenght'),
    category: z
        .string()
        .min(3, 'error:accommodation.faq.category.min_lenght')
        .max(25, 'error:accommodation.faq.category.max_lenght')
        .optional()
});

export type AccommodationFaqInput = z.infer<typeof AccommodationFaqSchema>;
