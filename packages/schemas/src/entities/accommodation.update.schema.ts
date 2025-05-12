import type { AccommodationType } from '@repo/types';
import { AccommodationTypeEnum, StateEnum } from '@repo/types';
import { z } from 'zod';

import {
    AccommodationAmenitiesSchema,
    AccommodationFaqSchema,
    AccommodationFeaturesSchema,
    AccommodationIaDataSchema,
    AccommodationPriceSchema,
    AccommodationRatingSchema,
    ContactInfoSchema,
    ExtraInfoSchema,
    FullLocationSchema,
    MediaSchema,
    ScheduleSchema,
    SeoSchema,
    SocialNetworkSchema
} from '../common.schema';

/**
 * Zod schema for updating an accommodation.
 * All fields are optional, useful for PATCH operations.
 */
export const AccommodationUpdateSchema: z.ZodType<
    Partial<
        Omit<
            AccommodationType,
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
    type: z
        .nativeEnum(AccommodationTypeEnum, {
            required_error: 'error:accommodation.typeRequired',
            invalid_type_error: 'error:accommodation.typeInvalid'
        })
        .optional(),
    description: z.string().optional(),
    contactInfo: ContactInfoSchema.optional(),
    socialNetworks: SocialNetworkSchema.optional(),
    price: AccommodationPriceSchema.optional(),
    ownerId: z.string().uuid({ message: 'error:accommodation.ownerIdInvalid' }).optional(),
    destinationId: z
        .string()
        .uuid({ message: 'error:accommodation.destinationIdInvalid' })
        .optional(),
    location: FullLocationSchema.optional(),
    features: z.array(AccommodationFeaturesSchema).optional(),
    amenities: z.array(AccommodationAmenitiesSchema).optional(),
    media: MediaSchema.optional(),
    rating: AccommodationRatingSchema.optional(),
    schedule: ScheduleSchema.optional(),
    extraInfo: ExtraInfoSchema.optional(),
    isFeatured: z.boolean().optional(),
    seo: SeoSchema.optional(),
    faqs: z.array(AccommodationFaqSchema).optional(),
    iaData: z.array(AccommodationIaDataSchema).optional(),
    state: z
        .nativeEnum(StateEnum, {
            required_error: 'error:accommodation.stateRequired',
            invalid_type_error: 'error:accommodation.stateInvalid'
        })
        .optional()
});
