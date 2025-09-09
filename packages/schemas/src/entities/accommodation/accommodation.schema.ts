import { z } from 'zod';
import { BaseAdminFields } from '../../common/admin.schema.js';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { BaseContactFields } from '../../common/contact.schema.js';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { BaseLifecycleFields } from '../../common/lifecycle.schema.js';
import { BaseLocationFields } from '../../common/location.schema.js';
import { BaseMediaFields } from '../../common/media.schema.js';
import { BaseModerationFields } from '../../common/moderation.schema.js';
import { BaseReviewFields } from '../../common/review.schema.js';
import { BaseSeoFields } from '../../common/seo.schema.js';
import { BaseVisibilityFields } from '../../common/visibility.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';
import { AccommodationAmenityRelationSchema } from '../amenity/amenity.schema.js';
import { AccommodationFeatureRelationSchema } from '../feature/feature.schema.js';
import { TagSchema } from '../tag/tag.schema.js';
import { AccommodationFaqSchema } from './accommodation.faq.schema.js';
import { AccommodationIaDataSchema } from './accommodation.ia.schema.js';
import { AccommodationPriceSchema } from './accommodation.price.schema.js';
import { AccommodationRatingSchema } from './accommodation.rating.schema.js';
import { AccommodationReviewSchema } from './accommodation.review.schema.js';

/**
 * Accommodation Schema - Main Entity Schema
 *
 * This schema defines the complete structure of an Accommodation entity
 * using base field objects for consistency and maintainability.
 *
 * NOTE: Reviews are handled by separate AccommodationReviewSchema entity.
 * This schema only contains review aggregation fields (reviewsCount, averageRating).
 */
export const AccommodationSchema = z.object({
    // Base fields
    id: AccommodationIdSchema,
    ...BaseAuditFields,
    // Entity fields - specific to accommodation
    slug: z
        .string()
        .min(3, { message: 'zodError.accommodation.slug.min' })
        .max(50, { message: 'zodError.accommodation.slug.max' }),
    name: z
        .string()
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' }),
    summary: z
        .string()
        .min(10, { message: 'zodError.accommodation.summary.min' })
        .max(300, { message: 'zodError.accommodation.summary.max' }),
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' }),
    isFeatured: z.boolean().default(false),
    ...BaseLifecycleFields,
    ...BaseModerationFields,
    ...BaseVisibilityFields,
    ...BaseReviewFields,
    ...BaseSeoFields,
    ...BaseContactFields,
    ...BaseLocationFields,
    ...BaseMediaFields,
    // Tags
    tags: z.array(TagSchema).optional(),

    // Relations
    features: z.array(AccommodationFeatureRelationSchema).optional(),
    amenities: z.array(AccommodationAmenityRelationSchema).optional(),
    reviews: z.array(AccommodationReviewSchema).optional(),
    rating: AccommodationRatingSchema.optional(),
    faqs: z.array(AccommodationFaqSchema).optional(),
    iaData: z.array(AccommodationIaDataSchema).optional(),

    ...BaseAdminFields,

    // Accommodation-specific core fields
    type: AccommodationTypeEnumSchema,
    destinationId: DestinationIdSchema,
    ownerId: UserIdSchema,

    // Price
    price: AccommodationPriceSchema.optional(),

    // Schedule
    schedule: z
        .object({
            checkInTime: z
                .string()
                .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
                    message: 'zodError.accommodation.schedule.checkInTime.format'
                })
                .optional(),
            checkOutTime: z
                .string()
                .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
                    message: 'zodError.accommodation.schedule.checkOutTime.format'
                })
                .optional(),
            minStay: z
                .number()
                .int()
                .min(1, {
                    message: 'zodError.accommodation.schedule.minStay.min'
                })
                .optional(),
            maxStay: z
                .number()
                .int()
                .min(1, {
                    message: 'zodError.accommodation.schedule.maxStay.min'
                })
                .optional(),
            availability: z
                .array(
                    z.object({
                        date: z.coerce.date(),
                        isAvailable: z.boolean(),
                        price: z.number().positive().optional()
                    })
                )
                .optional()
        })
        .optional(),

    // Extra Info
    extraInfo: z
        .object({
            capacity: z.number().int({
                message: 'zodError.accommodation.extraInfo.capacity.required'
            }),
            minNights: z.number().int({
                message: 'zodError.accommodation.extraInfo.minNights.required'
            }),
            maxNights: z.number().int().optional(),
            bedrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bedrooms.required'
            }),
            beds: z.number().int().optional(),
            bathrooms: z.number().int({
                message: 'zodError.accommodation.extraInfo.bathrooms.required'
            }),
            smokingAllowed: z.boolean().optional(),
            extraInfo: z.array(z.string()).optional()
        })
        .optional()
});

/**
 * Type export for the main Accommodation entity
 */
export type Accommodation = z.infer<typeof AccommodationSchema>;
