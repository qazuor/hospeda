import { z } from 'zod';
import {
    PreferedContactEnumSchema,
    PriceCurrencyEnumSchema,
    StateEnumSchema
} from './enums.schema';

/**
 * Zod schema for user reference by ID.
 */
const UserIdSchema = z.string().uuid({ message: 'error:base.userIdInvalid' });

/**
 * Zod schema for admin metadata.
 */
export const AdminInfoSchema = z.object({
    notes: z.string({ required_error: 'error:common.admin.notesRequired' }),
    favorite: z.boolean({ required_error: 'error:common.admin.favoriteRequired' })
});

/**
 * Zod schema for base entity (without tags).
 */
export const BaseEntitySchema = z.object({
    id: z.string().uuid({ message: 'error:base.idInvalid' }),
    name: z.string({ required_error: 'error:base.nameRequired' }),
    displayName: z.string({ required_error: 'error:base.displayNameRequired' }),
    state: StateEnumSchema,
    adminInfo: AdminInfoSchema.optional(),
    createdAt: z.coerce.date(),
    createdById: UserIdSchema,
    updatedAt: z.coerce.date(),
    updatedById: UserIdSchema,
    deletedAt: z.coerce.date().optional(),
    deletedById: z.string().uuid({ message: 'error:base.deletedByIdInvalid' }).optional()
});

/**
 * Zod schema for a tag entity.
 */
export const TagSchema = BaseEntitySchema.extend({
    ownerId: z.string().uuid({ message: 'error:tag.ownerIdInvalid' }),
    notes: z.string({ required_error: 'error:tag.notesRequired' }),
    variants: z.array(z.string({ required_error: 'error:tag.variantRequired' })),
    color: z.string({ required_error: 'error:tag.colorRequired' }),
    icon: z.string({ required_error: 'error:tag.iconRequired' }),
    entityIds: z.array(z.string().uuid()).optional(),
    entityTypes: z.array(z.string()).optional()
});

/**
 * Zod schema for geographic coordinates.
 */
export const CoordinatesSchema = z.object({
    lat: z.string({ required_error: 'error:common.coordinates.latRequired' }),
    long: z.string({ required_error: 'error:common.coordinates.longRequired' })
});

/**
 * Zod schema for base location.
 */
export const BaseLocationSchema = z.object({
    state: z.string({ required_error: 'error:common.location.stateRequired' }),
    zipCode: z.string({ required_error: 'error:common.location.zipCodeRequired' }),
    country: z.string({ required_error: 'error:common.location.countryRequired' }),
    coordinates: CoordinatesSchema.optional()
});

/**
 * Zod schema for full location.
 */
export const FullLocationSchema = BaseLocationSchema.extend({
    street: z.string({ required_error: 'error:common.location.streetRequired' }),
    number: z.string({ required_error: 'error:common.location.numberRequired' }),
    floor: z.string().optional(),
    apartment: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string({ required_error: 'error:common.location.cityRequired' }),
    deparment: z.string().optional()
});

/**
 * Zod schema for image.
 */
export const ImageSchema = z.object({
    url: z.string({ required_error: 'error:common.image.urlRequired' }),
    caption: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(TagSchema).optional(),
    state: StateEnumSchema
});

/**
 * Zod schema for video.
 */
export const VideoSchema = z.object({
    url: z.string({ required_error: 'error:common.video.urlRequired' }),
    caption: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(TagSchema).optional(),
    state: StateEnumSchema
});

/**
 * Zod schema for media content.
 */
export const MediaSchema = z.object({
    featuredImage: ImageSchema,
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});

/**
 * Zod schema for contact info.
 */
export const ContactInfoSchema = z.object({
    personalEmail: z.string({ required_error: 'error:common.contact.personalEmailRequired' }),
    workEmail: z.string().optional(),
    homePhone: z.string().optional(),
    workPhone: z.string().optional(),
    mobilePhone: z.string({ required_error: 'error:common.contact.mobilePhoneRequired' }),
    website: z.string().url({ message: 'error:common.contact.websiteInvalid' }).optional(),
    preferredEmail: PreferedContactEnumSchema,
    preferredPhone: PreferedContactEnumSchema
});

/**
 * Zod schema for social networks.
 */
export const SocialNetworkSchema = z.object({
    facebook: z.string().url({ message: 'error:common.social.facebookInvalid' }).optional(),
    twitter: z.string().url({ message: 'error:common.social.twitterInvalid' }).optional(),
    instagram: z.string().url({ message: 'error:common.social.instagramInvalid' }).optional(),
    linkedIn: z.string().url({ message: 'error:common.social.linkedinInvalid' }).optional(),
    tiktok: z.string().url({ message: 'error:common.social.tiktokInvalid' }).optional()
});

/**
 * Zod schema for base price.
 */
export const BasePriceSchema = z.object({
    price: z.number().optional(),
    currency: PriceCurrencyEnumSchema.optional()
});

/**
 * Zod schema for SEO metadata.
 */
export const SeoSchema = z.object({
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.array(z.string()).optional()
});
