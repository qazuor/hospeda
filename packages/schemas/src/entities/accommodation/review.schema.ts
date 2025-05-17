import { z } from 'zod';
import { BaseEntitySchema } from '../../common.schema.js';
import { AccommodationRatingSchema } from './rating.schema.js';

/**
 * Zod schema for a accommodation review entity.
 */
export const AccommodationReviewSchema = BaseEntitySchema.extend({
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
    rating: AccommodationRatingSchema
});

export type AccommodationReviewInput = z.infer<typeof AccommodationReviewSchema>;
