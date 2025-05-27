import { z } from 'zod';
import {
    WithActivityStateSchema,
    WithAdminInfoSchema,
    WithLifecycleStateSchema,
    WithSeoSchema,
    WithTagsSchema
} from '../../common/helpers.schema';
import { LocationSchema } from '../../common/location.schema';
import { MediaSchema } from '../../common/media.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';
import { DestinationAttractionSchema } from './destination.attraction.schema';
import { DestinationReviewSchema } from './destination.review.schema';

/**
 * Destination Input schema definition using Zod for validation.
 * Represents the input data required to create or update a destination.
 */
// Campos omitidos: id, createdAt, updatedAt, deletedAt, createdById, updatedById, deletedById
export const NewDestinationInputSchema = WithAdminInfoSchema.merge(WithLifecycleStateSchema)
    .merge(WithActivityStateSchema)
    .merge(WithTagsSchema)
    .merge(WithSeoSchema)
    .extend({
        slug: z
            .string()
            .min(3, { message: 'error:destination.slug.min_length' })
            .max(30, { message: 'error:destination.slug.max_length' }),
        name: z
            .string()
            .min(3, { message: 'error:destination.name.min_length' })
            .max(100, { message: 'error:destination.name.max_length' }),
        summary: z
            .string()
            .min(10, { message: 'error:destination.summary.min_length' })
            .max(200, { message: 'error:destination.summary.max_length' }),
        description: z
            .string()
            .min(10, { message: 'error:destination.description.min_length' })
            .max(2000, { message: 'error:destination.description.max_length' }),
        location: LocationSchema,
        media: MediaSchema,
        isFeatured: z.boolean().optional(),
        visibility: VisibilityEnumSchema,
        reviewsCount: z.number().optional(),
        averageRating: z.number().optional(),
        accommodationsCount: z.number().optional(),
        attractions: z.array(DestinationAttractionSchema).optional(),
        reviews: z.array(DestinationReviewSchema).optional()
    });

export const UpdateDestinationInputSchema = NewDestinationInputSchema.partial();

export type NewDestinationInput = z.infer<typeof NewDestinationInputSchema>;
export type UpdateDestinationInput = z.infer<typeof UpdateDestinationInputSchema>;
