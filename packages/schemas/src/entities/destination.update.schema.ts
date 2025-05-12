import type { DestinationType } from '@repo/types';
import { VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { BaseLocationSchema, MediaSchema, SeoSchema } from '../common.schema';

import { DestinationAttractionsSchema } from './destination_attractions.schema';
import { DestinationRatingSchema } from './destination_rating.schema';

/**
 * Zod schema for updating a destination.
 * All fields are optional.
 */
export const DestinationUpdateSchema: z.ZodType<
    Partial<
        Omit<
            DestinationType,
            | 'id'
            | 'createdAt'
            | 'createdById'
            | 'updatedAt'
            | 'updatedById'
            | 'deletedAt'
            | 'deletedById'
        >
    >
> = z.object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    slug: z.string().optional(),
    summary: z.string().optional(),
    description: z.string().optional(),
    media: MediaSchema.optional(),
    isFeatured: z.boolean().optional(),
    visibility: z
        .nativeEnum(VisibilityEnum, {
            required_error: 'error:destination.visibilityRequired',
            invalid_type_error: 'error:destination.visibilityInvalid'
        })
        .optional(),
    seo: SeoSchema.optional(),
    rating: DestinationRatingSchema.optional(),
    location: BaseLocationSchema.optional(),
    attractions: z.array(DestinationAttractionsSchema).optional(),
    state: z
        .nativeEnum(VisibilityEnum, {
            required_error: 'error:destination.stateRequired',
            invalid_type_error: 'error:destination.stateInvalid'
        })
        .optional()
});
