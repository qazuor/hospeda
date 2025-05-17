import { z } from 'zod';
import {
    BaseEntitySchema,
    ContactInfoSchema,
    FullLocationSchema,
    MediaSchema,
    SeoSchema,
    SocialNetworkSchema,
    TagSchema
} from '../common.schema.js';
import { AccommodationTypeEnumSchema } from '../enums.schema.js';
import { SlugRegex, omittedBaseEntityFieldsForActions } from '../utils/utils.js';
import { AccommodationAmenitiesSchema } from './accommodation/amenities.schema.js';
import { AccommodationExtraInfoSchema } from './accommodation/extraInfo.schema.js';
import { AccommodationFaqSchema } from './accommodation/faq.schema.js';
import { AccommodationFeaturesSchema } from './accommodation/features.schema.js';
import { AccommodationIaDataSchema } from './accommodation/iaData.schema.js';
import { AccommodationPriceSchema } from './accommodation/price.schema.js';
import { AccommodationRatingSchema } from './accommodation/rating.schema.js';
import { AccommodationReviewSchema } from './accommodation/review.schema.js';
import { AccommodationScheduleSchema } from './accommodation/schedule.schema.js';

/**
 * Zod schema for a Accommodation entity.
 */
export const AccommodationSchema = BaseEntitySchema.extend({
    slug: z
        .string()
        .min(3, 'error:accommodation.slug.min_lenght')
        .max(30, 'error:accommodation.slug.max_lenght')
        .regex(SlugRegex, {
            message: 'error:accommodation.slug.pattern'
        }),
    type: AccommodationTypeEnumSchema,
    description: z
        .string()
        .min(50, 'error:accommodation.description.min_lenght')
        .max(1000, 'error:accommodation.description.max_lenght'),
    contactInfo: ContactInfoSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    price: AccommodationPriceSchema.optional(),
    location: FullLocationSchema.optional(),
    features: z.array(AccommodationFeaturesSchema.optional()),
    amenities: z.array(AccommodationAmenitiesSchema.optional()),
    media: MediaSchema.optional(),
    rating: AccommodationRatingSchema,
    reviews: z.array(AccommodationReviewSchema).optional(),
    schedule: AccommodationScheduleSchema.optional(),
    extraInfo: AccommodationExtraInfoSchema.optional(),
    isFeatured: z.boolean({
        required_error: 'error:accommodation.isFeatured.required',
        invalid_type_error: 'error:accommodation.isFeatured.invalid_type'
    }),
    seo: SeoSchema.optional(),
    faqs: z.array(AccommodationFaqSchema.optional()),
    iaData: z.array(AccommodationIaDataSchema).optional(),
    tags: z.array(TagSchema).optional()
});

export type AccommodationInput = z.infer<typeof AccommodationSchema>;

export const AccommodationCreateSchema = AccommodationSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof AccommodationSchema.shape,
        true
    >
);

export const AccommodationUpdateSchema = AccommodationSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof AccommodationSchema.shape,
        true
    >
).partial();
