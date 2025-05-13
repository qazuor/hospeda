import { z } from 'zod';

/**
 * Zod schema accommodation/faq relationship.
 */
export const AccommodationFaqRelationSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_faq.accommodationId.invalid' }),
    faqId: z.string().uuid({ message: 'error:accommodation_faq.faqId.invalid' })
});

export type AccommodationFaqRelationInput = z.infer<typeof AccommodationFaqRelationSchema>;
