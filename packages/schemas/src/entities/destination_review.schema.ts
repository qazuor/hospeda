import type { DestinationReviewType } from '@repo/types';
import { z } from 'zod';

import { DestinationRatingSchema } from './destination_rating.schema';

/**
 * Zod schema for a review submitted for a destination.
 */
export const DestinationReviewSchema: z.ZodType<DestinationReviewType> = z.object({
    userId: z.string().uuid({
        message: 'error:destinationReview.userIdInvalid'
    }),
    destinationId: z.string().uuid({
        message: 'error:destinationReview.destinationIdInvalid'
    }),
    title: z.string({
        required_error: 'error:destinationReview.titleRequired'
    }),
    content: z.string({
        required_error: 'error:destinationReview.contentRequired'
    }),
    rating: DestinationRatingSchema
});
