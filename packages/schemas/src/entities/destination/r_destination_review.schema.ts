import { z } from 'zod';

/**
 * Zod schema destionation/review relationship.
 */
export const DestinationReviewRelationSchema = z.object({
    destionationId: z.string().uuid({ message: 'error:destination_review.destionationId.invalid' }),
    reviewId: z.string().uuid({ message: 'error:destination_review.reviewId.invalid' })
});

export type DestinationReviewRelationInput = z.infer<typeof DestinationReviewRelationSchema>;
