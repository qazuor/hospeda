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
 * Zod schema for creating a new accommodation.
 * Includes only user-submittable fields.
 */
export const AccommodationCreateSchema: z.ZodType<
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
> = z.object({
    name: z.string({ required_error: 'error:accommodation.nameRequired' }),
    displayName: z.string({ required_error: 'error:accommodation.displayNameRequired' }),
    slug: z.string({ required_error: 'error:accommodation.slugRequired' }),
    type: z.nativeEnum(AccommodationTypeEnum, {
        required_error: 'error:accommodation.typeRequired',
        invalid_type_error: 'error:accommodation.typeInvalid'
    }),
    description: z.string({ required_error: 'error:accommodation.descriptionRequired' }),
    contactInfo: ContactInfoSchema,
    socialNetworks: SocialNetworkSchema,
    price: AccommodationPriceSchema,
    ownerId: z.string().uuid({ message: 'error:accommodation.ownerIdInvalid' }),
    destinationId: z.string().uuid({ message: 'error:accommodation.destinationIdInvalid' }),
    location: FullLocationSchema,
    features: z.array(AccommodationFeaturesSchema).optional(),
    amenities: z.array(AccommodationAmenitiesSchema).optional(),
    media: MediaSchema.optional(),
    rating: AccommodationRatingSchema,
    reviews: z.array(z.any()).optional(), // reviews no se crean con el alojamiento
    schedule: ScheduleSchema.optional(),
    extraInfo: ExtraInfoSchema.optional(),
    isFeatured: z.boolean().optional(),
    seo: SeoSchema.optional(),
    faqs: z.array(AccommodationFaqSchema).optional(),
    iaData: z.array(AccommodationIaDataSchema).optional(),
    state: z.nativeEnum(StateEnum, {
        required_error: 'error:accommodation.stateRequired',
        invalid_type_error: 'error:accommodation.stateInvalid'
    })
});
