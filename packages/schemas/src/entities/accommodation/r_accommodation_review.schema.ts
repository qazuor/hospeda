import { z } from 'zod';

/**
 * Zod schema accommodation/review relationship.
 */
export const AccommodationReviewRelationSchema = z.object({
    accommodationId: z
        .string()
        .uuid({ message: 'error:accommodation_review.accommodationId.invalid' }),
    reviewId: z.string().uuid({ message: 'error:accommodation_review.reviewId.invalid' })
});

export type AccommodationReviewRelationInput = z.infer<typeof AccommodationReviewRelationSchema>;
