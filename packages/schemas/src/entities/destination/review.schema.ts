import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema';
import { DestinationRatingSchema } from './rating.schema';

/**
 * Zod schema for a destination review entity.
 */
export const DestinationReviewSchema = BaseEntitySchema.extend({
    title: z
        .string()
        .min(1, 'error:destination.review.title.min_lenght')
        .max(20, 'error:destination.review.title.max_lenght')
        .optional(),
    content: z
        .string()
        .min(10, 'error:destination.review.content.min_lenght')
        .max(150, 'error:destination.review.content.max_lenght')
        .optional(),
    rating: DestinationRatingSchema
});

export type DestinationReviewInput = z.infer<typeof DestinationReviewSchema>;
