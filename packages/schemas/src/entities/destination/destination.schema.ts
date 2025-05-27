import { z } from 'zod';
import {
    WithActivityStateSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithSeoSchema,
    WithSoftDeleteSchema,
    WithTagsSchema
} from '../../common/helpers.schema';
import { LocationSchema } from '../../common/location.schema';
import { MediaSchema } from '../../common/media.schema';
import { VisibilityEnumSchema } from '../../enums/visibility.enum.schema';
import { DestinationAttractionSchema } from './destination.attraction.schema';
import { DestinationReviewSchema } from './destination.review.schema';

/**
 * Destination schema definition using Zod for validation.
 * Attractions array requires at least 3 elements.
 * All error messages use the 'zodError.' prefix for consistency.
 */
export const DestinationSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithActivityStateSchema)
    .merge(WithSoftDeleteSchema)
    .merge(WithTagsSchema)
    .merge(WithSeoSchema)
    .extend({
        /** Unique slug for the destination */
        slug: z
            .string()
            .min(3, { message: 'zodError.destination.slug.min_length' })
            .max(30, { message: 'zodError.destination.slug.max_length' }),
        /** Name of the destination */
        name: z
            .string()
            .min(3, { message: 'zodError.destination.name.min_length' })
            .max(100, { message: 'zodError.destination.name.max_length' }),
        /** Short summary, 10-200 characters */
        summary: z
            .string()
            .min(10, { message: 'zodError.destination.summary.min_length' })
            .max(200, { message: 'zodError.destination.summary.max_length' }),
        /** Detailed description, 10-2000 characters */
        description: z
            .string()
            .min(10, { message: 'zodError.destination.description.min_length' })
            .max(2000, { message: 'zodError.destination.description.max_length' }),
        /** Location object */
        location: LocationSchema,
        /** Media object */
        media: MediaSchema,
        /** Whether the destination is featured, optional */
        isFeatured: z.boolean().optional(),
        /** Visibility enum */
        visibility: VisibilityEnumSchema,
        /** Number of reviews, optional */
        reviewsCount: z.number().optional(),
        /** Average rating, optional */
        averageRating: z.number().optional(),
        /** Number of accommodations, optional */
        accommodationsCount: z.number().optional(),
        /** List of attractions, at least 3 required */
        attractions: z
            .array(DestinationAttractionSchema)
            .min(3, { message: 'zodError.destination.attractions.min' })
            .optional(),
        /** List of reviews, optional */
        reviews: z.array(DestinationReviewSchema).optional()
    });

export type DestinationInput = z.infer<typeof DestinationSchema>;
