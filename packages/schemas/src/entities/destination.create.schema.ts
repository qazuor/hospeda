import type { DestinationType } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { BaseLocationSchema, MediaSchema, SeoSchema } from '../common.schema';

import { DestinationAttractionsSchema } from './destination_attractions.schema';
import { DestinationRatingSchema } from './destination_rating.schema';

/**
 * Zod schema for creating a destination.
 */
export const DestinationCreateSchema: z.ZodType<
    Omit<
        DestinationType,
        | 'id'
        | 'createdAt'
        | 'createdById'
        | 'updatedAt'
        | 'updatedById'
        | 'deletedAt'
        | 'deletedById'
        | 'reviews'
    >
> = z.object({
    name: z.string({ required_error: 'error:destination.nameRequired' }),
    displayName: z.string({ required_error: 'error:destination.displayNameRequired' }),
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
    location: BaseLocationSchema,
    attractions: z.array(DestinationAttractionsSchema),
    state: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:destination.stateRequired',
        invalid_type_error: 'error:destination.stateInvalid'
    })
});
