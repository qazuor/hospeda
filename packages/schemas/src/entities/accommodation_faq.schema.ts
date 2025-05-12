import type { AccommodationFaqType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';

/**
 * Zod schema for accommodation FAQ entry.
 */
export const AccommodationFaqSchema: z.ZodType<AccommodationFaqType> = BaseEntitySchema.extend({
    accommodationId: z.string().uuid({
        message: 'error:accommodationFaq.accommodationIdInvalid'
    }),
    question: z.string({
        required_error: 'error:accommodationFaq.questionRequired'
    }),
    answer: z.string({
        required_error: 'error:accommodationFaq.answerRequired'
    }),
    category: z.string().optional()
});
