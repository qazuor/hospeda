import { VisibilityEnumSchema } from '@repo/schemas/enums/visibility.enum.schema.js';
import { z } from 'zod';
import {
    AccommodationIdSchema,
    ContactInfoSchema,
    LocationSchema,
    MediaSchema,
    SocialNetworkSchema,
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
import { AccommodationTypeEnumSchema } from '../../enums/index.js';
import { DestinationSchema } from '../destination/destination.schema.js';
import { UserSchema } from '../user/user.schema.js';
import { AccommodationAmenitySchema } from './accommodation.amenity.schema.js';
import { ExtraInfoSchema } from './accommodation.extrainfo.schema.js';
import { AccommodationFaqSchema } from './accommodation.faq.schema.js';
import { AccommodationFeatureSchema } from './accommodation.feature.schema.js';
import { AccommodationIaDataSchema } from './accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './accommodation.price.schema.js';
import { AccommodationRatingSchema } from './accommodation.rating.schema.js';
import { AccommodationReviewSchema } from './accommodation.review.schema.js';
import { ScheduleSchema } from './accommodation.schedule.schema.js';

/**
 * Accommodation schema definition using Zod for validation.
 * Includes references to user (owner) and destination schemas.
 * Arrays like features and amenities require at least 2 elements.
 */
export const AccommodationSchema = WithIdSchema.merge(WithAuditSchema)
    .merge(WithLifecycleStateSchema)
    .merge(WithVisibilitySchema)
    .merge(WithReviewStateSchema)
    .merge(WithModerationStatusSchema)
    .merge(WithTagsSchema)
    .merge(WithSeoSchema)
    .merge(WithAdminInfoSchema)
    .extend({
        id: AccommodationIdSchema,
        /** Unique slug for the accommodation */
        slug: z
            .string({
                required_error: 'zodError.accommodation.slug.required',
                invalid_type_error: 'zodError.accommodation.slug.invalidType'
            })
            .min(3, { message: 'zodError.accommodation.slug.min' })
            .max(50, { message: 'zodError.accommodation.slug.max' }),
        /** Name of the accommodation */
        name: z
            .string({
                required_error: 'zodError.accommodation.name.required',
                invalid_type_error: 'zodError.accommodation.name.invalidType'
            })
            .min(3, { message: 'zodError.accommodation.name.min' })
            .max(100, { message: 'zodError.accommodation.name.max' }),
        /** Short summary, 10-300 characters */
        summary: z
            .string({
                required_error: 'zodError.accommodation.summary.required',
                invalid_type_error: 'zodError.accommodation.summary.invalidType'
            })
            .min(10, { message: 'zodError.accommodation.summary.min' })
            .max(300, { message: 'zodError.accommodation.summary.max' }),
        /** Accommodation type (enum) */
        type: AccommodationTypeEnumSchema,
        /** Detailed description, 30-2000 characters */
        description: z
            .string({
                required_error: 'zodError.accommodation.description.required',
                invalid_type_error: 'zodError.accommodation.description.invalidType'
            })
            .min(30, { message: 'zodError.accommodation.description.min' })
            .max(2000, { message: 'zodError.accommodation.description.max' }),
        /** Contact information, optional */
        contactInfo: ContactInfoSchema.optional(),
        /** Social networks, optional */
        socialNetworks: SocialNetworkSchema.optional(),
        /** Price information, optional */
        price: AccommodationPriceSchema.optional(),
        /** Location information, optional */
        location: LocationSchema.optional(),
        /** Media assets, optional */
        media: MediaSchema.optional(),
        /** Whether the accommodation is featured, optional */
        isFeatured: z.boolean({
            required_error: 'zodError.accommodation.isFeatured.required',
            invalid_type_error: 'zodError.accommodation.isFeatured.invalidType'
        }),
        /** Owner user ID */
        ownerId: z
            .string({
                required_error: 'zodError.accommodation.ownerId.required',
                invalid_type_error: 'zodError.accommodation.ownerId.invalidType'
            })
            .uuid({ message: 'zodError.accommodation.ownerId.invalidUuid' }),
        /** Owner user object, optional */
        owner: UserSchema.optional(),
        /** Destination ID */
        destinationId: z
            .string({
                required_error: 'zodError.accommodation.destinationId.required',
                invalid_type_error: 'zodError.accommodation.destinationId.invalidType'
            })
            .uuid({ message: 'zodError.accommodation.destinationId.invalidUuid' }),
        /** Destination object, optional */
        destination: DestinationSchema.optional(),
        /** List of features, at least 2 required */
        features: z.array(AccommodationFeatureSchema).optional(),
        /** List of amenities, at least 2 required */
        amenities: z.array(AccommodationAmenitySchema).optional(),
        /** List of reviews, optional */
        reviews: z.array(AccommodationReviewSchema).optional(),
        /** Rating object, optional */
        rating: AccommodationRatingSchema.optional(),
        /** Schedule object, optional */
        schedule: ScheduleSchema.optional(),
        /** Extra information, optional */
        extraInfo: ExtraInfoSchema.optional(),
        /** List of FAQs, optional */
        faqs: z.array(AccommodationFaqSchema).optional(),
        /** List of AI data objects, optional */
        iaData: z.array(AccommodationIaDataSchema).optional()
    });

export const AccommodationFilterInputSchema = z.object({
    city: z.string().optional(),
    country: z.string().optional(),
    tags: WithTagsSchema.shape.tags.optional(),
    visibility: VisibilityEnumSchema.optional(),
    isFeatured: z.boolean().optional(),
    minRating: z.number().min(0).max(5).optional(),
    maxRating: z.number().min(0).max(5).optional(),
    q: z.string().optional() // free text search
});

// Input para ordenamiento de resultados
export const AccommodationSortInputSchema = z.object({
    sortBy: z.enum(['name', 'createdAt', 'averageRating', 'reviewsCount', 'price']).optional(),
    order: z.enum(['asc', 'desc']).optional()
});
