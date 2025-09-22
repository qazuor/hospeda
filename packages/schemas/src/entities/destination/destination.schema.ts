import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { DestinationIdSchema } from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseLocationFields } from '../../common/location.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AttractionSchema } from '../attraction/attraction.schema.js';
import { DestinationReviewSchema } from '../destinationReview/destinationReview.schema.js';
import { TagSchema } from '../tag/tag.schema.js';
import { DestinationRatingSchema } from './subtypes/destination.rating.schema.js';

/**
 * Destination Schema - Main Entity Schema
 *
 * This schema defines the complete structure of a Destination entity
 * using base field objects for consistency and maintainability.
 *
 * NOTE: Reviews are handled by separate DestinationReviewSchema entity.
 * This schema only contains review aggregation fields (reviewsCount, averageRating).
 */
export const DestinationSchema = z.object({
    // Base fields
    id: DestinationIdSchema,
    ...BaseAuditFields,
    // Entity fields - specific to destination
    slug: z
        .string()
        .min(3, { message: 'zodError.destination.slug.min' })
        .max(50, { message: 'zodError.destination.slug.max' }),
    name: z
        .string()
        .min(3, { message: 'zodError.destination.name.min' })
        .max(100, { message: 'zodError.destination.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.destination.summary.min' })
        .max(300, { message: 'zodError.destination.summary.max' }),
    description: z
        .string()
        .min(30, { message: 'zodError.destination.description.min' })
        .max(2000, { message: 'zodError.destination.description.max' }),
    isFeatured: z.boolean().default(false),
    ...BaseLifecycleFields,
    ...BaseAdminFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    // Tags
    tags: z.array(TagSchema).optional(),

    // Location (required for destinations)
    ...BaseLocationFields,

    // Media (using base object)
    ...BaseMediaFields,

    // Destination-specific fields
    accommodationsCount: z.number().int().min(0).default(0),

    // Attractions (nested objects)
    attractions: z.array(AttractionSchema).optional(),
    reviews: z.array(DestinationReviewSchema).optional(),
    rating: DestinationRatingSchema.optional()
});

/**
 * Type export for the main Destination entity
 */
export type Destination = z.infer<typeof DestinationSchema>;
