import { z } from 'zod';
import {
    LocationSchema,
    MediaSchema,
    TagsArraySchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithReviewStateSchema,
    WithSeoSchema,
    WithTagsSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { VisibilityEnumSchema } from '../../enums/index.js';
import { DestinationAttractionSchema } from './destination.attraction.schema.js';
import { DestinationReviewSchema } from './destination.review.schema.js';

/**
 * Destination schema definition using Zod for validation.
 * Attractions array requires at least 3 elements.
 * All error messages use the 'zodError.' prefix for consistency.
 */
export const DestinationSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithAdminInfoSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithVisibilitySchema)
    .merge(WithReviewStateSchema)
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

// Input para filtros de búsqueda de destinos
export const DestinationFilterInputSchema = z.object({
    state: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    tags: TagsArraySchema.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    q: z.string().optional() // free text search
});

// Input para ordenamiento de resultados
export const DestinationSortInputSchema = z.object({
    sortBy: z
        .enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'accommodationsCount'])
        .optional(),
    order: z.enum(['asc', 'desc']).optional()
});
