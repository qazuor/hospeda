import type { AccommodationReviewType } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema } from '../common.schema';
import { AccommodationRatingSchema } from './accommodation_rating.schema';

/**
 * Zod schema for accommodation review.
 */
export const AccommodationReviewSchema: z.ZodType<AccommodationReviewType> =
    BaseEntitySchema.extend({
        userId: z.string().uuid({
            message: 'error:accommodationReview.userIdInvalid'
        }),
        accommodationId: z.string().uuid({
            message: 'error:accommodationReview.accommodationIdInvalid'
        }),
        title: z.string({
            required_error: 'error:accommodationReview.titleRequired'
        }),
        content: z.string({
            required_error: 'error:accommodationReview.contentRequired'
        }),
        rating: AccommodationRatingSchema
    });
