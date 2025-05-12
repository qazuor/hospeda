import type { DestinationType } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { BaseEntitySchema, BaseLocationSchema, MediaSchema, SeoSchema } from '../common.schema';

import { DestinationRatingSchema } from './destination_rating.schema';

import { DestinationReviewSchema } from './destination_review.schema';

import { DestinationAttractionsSchema } from './destination_attractions.schema';

/**
 * Zod schema for full destination entity.
 */
export const DestinationSchema: z.ZodType<DestinationType> = BaseEntitySchema.extend({
    slug: z.string({ required_error: 'error:destination.slugRequired' }),
    summary: z.string({ required_error: 'error:destination.summaryRequired' }),
    description: z.string({ required_error: 'error:destination.descriptionRequired' }),
    media: MediaSchema,
    isFeatured: z.boolean().optional(),
    visibility: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:destination.visibilityRequired',
        invalid_type_error: 'error:destination.visibilityInvalid'
    }),
    seo: SeoSchema.optional(),
    rating: DestinationRatingSchema.optional(),
    reviews: z.array(DestinationReviewSchema).optional(),
    location: BaseLocationSchema,
    attractions: z.array(DestinationAttractionsSchema)
});
