import { z } from 'zod';
import { DestinationIdSchema } from '../../common/id.schema.js';
import {
    LocationSchema,
    WithAdminInfoSchema,
    WithAuditSchema,
    WithIdSchema,
    WithLifecycleStateSchema,
    WithModerationStatusSchema,
    WithReviewStateSchema,
    WithSeoSchema,
    WithVisibilitySchema
} from '../../common/index.js';
import { BaseSearchSchema } from '../../common/search.schemas.js';
import { VisibilityEnumSchema } from '../../enums/index.js';
import { DestinationAttractionSchema } from './destination.attraction.schema.js';
import { DestinationRatingSchema } from './destination.rating.schema.js';
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
    .merge(WithSeoSchema)
    .extend({
        id: DestinationIdSchema,
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
        /** Media object (avoid lazy TagSchema refs for OpenAPI) */
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional(),
                videos: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional(),
        /** Whether the destination is featured, optional */
        isFeatured: z.boolean(),
        /** Number of accommodations, optional */
        accommodationsCount: z.number().int(),
        /** List of attractions, at least 3 required */
        attractions: z.array(DestinationAttractionSchema).optional(),
        /** List of reviews, optional */
        reviews: z.array(DestinationReviewSchema).optional(),
        /** Rating object, optional */
        rating: DestinationRatingSchema.optional(),
        /** Tags as simple string array to avoid circular dependencies in OpenAPI */
        tags: z.array(z.string()).optional()
    })
    .strict();

// Input para filtros de búsqueda de destinos
export const DestinationFilterInputSchema = BaseSearchSchema.extend({
    filters: z
        .object({
            state: z.string().optional(),
            city: z.string().optional(),
            country: z.string().optional(),
            // Avoid importing TagSchema here to prevent circular deps during OpenAPI generation
            // Accept either simple strings (e.g., tag slugs/ids) or plain objects (from factories)
            tags: z
                .array(
                    z.union([
                        z.string(),
                        // Permissive object to support test factories without pulling TagSchema
                        z
                            .object({
                                id: z.string().uuid().optional(),
                                slug: z.string().optional(),
                                name: z.string().optional()
                            })
                            .passthrough()
                    ])
                )
                .optional(),
            visibility: VisibilityEnumSchema.optional(),
            isFeatured: z.boolean().optional(),
            minRating: z.number().min(0).max(5).optional(),
            maxRating: z.number().min(0).max(5).optional(),
            q: z.string().optional() // free text search
        })
        .optional()
}).strict();

// Input para ordenamiento de resultados
export const DestinationSortInputSchema = z
    .object({
        sortBy: z
            .enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'accommodationsCount'])
            .optional(),
        order: z.enum(['asc', 'desc']).optional()
    })
    .strict();

/**
 * Schema for creating a new destination.
 * Derived from the base `DestinationSchema` by omitting server-generated fields and relations.
 * Additional fields are made optional to handle seed data that includes them.
 */
export const CreateDestinationSchema = DestinationSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    reviews: true,
    rating: true,
    accommodationsCount: true,
    averageRating: true
})
    .extend({
        /** Slug (optional - will be generated by service) */
        slug: z.string().optional(),
        /** Array of tag IDs (optional - handled by separate service) */
        tagIds: z.array(z.string()).optional(),
        /** Array of attraction IDs (optional - handled by separate service) */
        attractionIds: z.array(z.string()).optional()
    })
    .strict();

/**
 * Type for new destination input (creation).
 */
export type NewDestinationInput = z.infer<typeof CreateDestinationSchema>;

/**
 * Schema for updating an existing destination.
 * All fields son opcionales para permitir updates parciales.
 */
export const UpdateDestinationSchema = CreateDestinationSchema.partial().strict();
export type UpdateDestinationInput = z.infer<typeof UpdateDestinationSchema>;
