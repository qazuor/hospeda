import { z } from 'zod';
import {
    PreferedContactEnumSchema,
    PriceCurrencyEnumSchema,
    StateEnumSchema,
    TagColorEnumSchema
} from './enums.schema.js';

/**
 * Zod schema for admin metadata.
 */
export const AdminInfoSchema = z.object({
    notes: z.string().min(3, 'error:common.admin.notes.min_lenght').optional(),
    favorite: z.boolean({ required_error: 'error:common.admin.favorite.required' })
});

export type AdminInfoInput = z.infer<typeof AdminInfoSchema>;

/**
 * Zod schema for base entity (without tags).
 */
export const BaseEntitySchema = z.object({
    id: z.string().uuid({ message: 'error:base.id.invalid' }),
    name: z.string({ required_error: 'error:base.name.required' }),
    displayName: z.string({ required_error: 'error:base.displayName.required' }),
    state: StateEnumSchema,
    adminInfo: AdminInfoSchema.optional(),
    createdAt: z.coerce.date(),
    createdById: z
        .string()
        .min(1, 'error:base.createdById.required')
        .uuid({ message: 'error:base.createdById.invalid' }),
    updatedAt: z.coerce.date(),
    updatedById: z
        .string()
        .min(1, 'error:base.updatedById.required')
        .uuid({ message: 'error:base.createdById.invalid' }),
    deletedAt: z.coerce.date().optional(),
    deletedById: z.string().uuid({ message: 'error:base.deletedById.invalid' }).optional()
});

export type BaseEntityInput = z.infer<typeof BaseEntitySchema>;

/**
 * Zod schema for a tag entity.
 */
export const TagSchema = BaseEntitySchema.extend({
    ownerId: z.string().uuid({ message: 'error:common.tag.ownerId.invalid' }),
    notes: z.string().min(1, 'error:common.tag.notes.min_lenght').optional(),
    color: TagColorEnumSchema,
    // TODO: ver como mejorar esto. usamos Url o un image upload?
    icon: z.string().min(1, 'error:common.tag.icon.min_lenght').optional()
});

export type TagInput = z.infer<typeof TagSchema>;

/**
 * Zod schema for contact info.
 */

const PhoneNumberRegExp = /^\+?\d{7,15}$/;

export const ContactInfoSchema = z.object({
    personalEmail: z
        .string()
        .email({ message: 'error:common.contact.personalEmail.invalid' })
        .optional(),
    workEmail: z.string().email({ message: 'error:common.contact.workEmail.invalid' }).optional(),
    homePhone: z
        .string()
        .regex(PhoneNumberRegExp, { message: 'error:common.contact.homePhone.invalid' })
        .optional(),
    workPhone: z
        .string()
        .regex(PhoneNumberRegExp, { message: 'error:common.contact.workPhone.invalid' })
        .optional(),
    mobilePhone: z
        .string({ required_error: 'error:common.contact.mobilePhone.required' })
        .regex(PhoneNumberRegExp, { message: 'error:common.contact.mobilePhone.invalid' }),
    website: z.string().url({ message: 'error:common.contact.website.url_invalid' }).optional(),
    preferredEmail: PreferedContactEnumSchema,
    preferredPhone: PreferedContactEnumSchema
});

export type ContactInfoInput = z.infer<typeof ContactInfoSchema>;

/**
 * Zod schema for geographic coordinates.
 */
export const CoordinatesSchema = z.object({
    lat: z
        .number({ required_error: 'error:common.location.lat.required' })
        .min(-90, { message: 'error:common.location.lat.min_value' })
        .max(90, { message: 'error:common.location.lat.max_value' }),
    long: z
        .number({ required_error: 'error:common.location.long.required' })
        .min(-180, { message: 'error:common.location.long.min_value' })
        .max(180, { message: 'error:common.location.long.max_value' })
});

export type CoordinatesInput = z.infer<typeof CoordinatesSchema>;

/**
 * Zod schema for base location.
 */
export const BaseLocationSchema = z.object({
    state: z.string({ required_error: 'error:common.location.state.required' }),
    zipCode: z.string({ required_error: 'error:common.location.zipCode.required' }),
    country: z.string({ required_error: 'error:common.location.country.required' }),
    coordinates: CoordinatesSchema.optional()
});

export type BaseLocationInput = z.infer<typeof BaseLocationSchema>;

/**
 * Zod schema for full location.
 */
export const FullLocationSchema = BaseLocationSchema.extend({
    street: z.string({ required_error: 'error:common.location.street.required' }),
    number: z.string({ required_error: 'error:common.location.number.required' }),
    floor: z.string().optional(),
    apartment: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string({ required_error: 'error:common.location.city.required' }),
    deparment: z.string().optional()
});

export type FullLocationInput = z.infer<typeof FullLocationSchema>;

/**
 * Zod schema for social networks.
 */
export const SocialNetworkSchema = z.object({
    facebook: z
        .string()
        .url({ message: 'error:common.social.facebook.url_invalid' })
        .regex(/^https:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.\-_/]+$/, {
            message: 'error:common.social.facebook.invalid'
        })
        .optional(),

    twitter: z
        .string()
        .url({ message: 'error:common.social.twitter.url_invalid' })
        .regex(/^https:\/\/(www\.)?twitter\.com\/[A-Za-z0-9_]+$/, {
            message: 'error:common.social.twitter.invalid'
        })
        .optional(),

    instagram: z
        .string()
        .url({ message: 'error:common.social.instagram.url_invalid' })
        .regex(/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+$/, {
            message: 'error:common.social.instagram.invalid'
        })
        .optional(),

    linkedIn: z
        .string()
        .url({ message: 'error:common.social.linkedin.url_invalid' })
        .regex(/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+$/, {
            message: 'error:common.social.linkedin.invalid'
        })
        .optional(),

    tiktok: z
        .string()
        .url({ message: 'error:common.social.tiktok.url_invalid' })
        .regex(/^https:\/\/(www\.)?tiktok\.com\/@([A-Za-z0-9._]+)$/, {
            message: 'error:common.social.tiktok.invalid'
        })
        .optional()
});

export type SocialNetworkInput = z.infer<typeof SocialNetworkSchema>;

/**
 * Zod schema for base price.
 */
export const BasePriceSchema = z.object({
    price: z.number().min(1, 'error:common.basePrice.min_value').optional(),
    currency: PriceCurrencyEnumSchema.optional()
});

export type BasePriceInput = z.infer<typeof BasePriceSchema>;

/**
 * Zod schema for image.
 */
export const ImageSchema = z.object({
    url: z
        .string({ required_error: 'error:common.image.url.required' })
        .url({ message: 'error:common.image.url.invalid' }),
    caption: z
        .string()
        .min(3, 'error:common.image.alt.min_lenght')
        .max(20, 'error:common.image.alt.max_lenght')
        .optional(),
    description: z
        .string()
        .min(3, 'error:common.image.description.min_lenght')
        .max(100, 'error:common.image.description.max_lenght')
        .optional(),
    tags: z.array(TagSchema).optional(),
    state: StateEnumSchema
});

export type ImageInput = z.infer<typeof ImageSchema>;

/**
 * Zod schema for video.
 */
export const VideoSchema = z.object({
    url: z
        .string({ required_error: 'error:common.video.url.required' })
        .url({ message: 'error:common.video.url.invalid' }),
    caption: z
        .string()
        .min(3, 'error:common.video.caption.min_lenght')
        .max(20, 'error:common.video.caption.max_lenght')
        .optional(),
    description: z
        .string()
        .min(3, 'error:common.video.description.min_lenght')
        .max(100, 'error:common.video.description.max_lenght')
        .optional(),
    tags: z.array(TagSchema).optional(),
    state: StateEnumSchema
});

export type VideoInput = z.infer<typeof VideoSchema>;

/**
 * Zod schema for media content.
 */
export const MediaSchema = z.object({
    featuredImage: ImageSchema,
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});

export type MediaInput = z.infer<typeof MediaSchema>;

/**
 * Zod schema for SEO metadata.
 */
export const SeoSchema = z.object({
    seoTitle: z
        .string()
        .min(10, 'error:common.seo.title.min_lenght')
        .max(60, 'error:common.seo.title.max_lenght')
        .optional(),
    seoDescription: z
        .string()
        .min(50, 'error:common.seo.description.min_lenght')
        .max(150, 'error:common.seo.description.max_lenght')
        .optional(),
    seoKeywords: z
        .array(z.string())
        .min(1, 'error:common.seo.keywords.min_lenght')
        .max(10, 'error:common.seo.keywords.max_lenght')
        .refine((arr) => new Set(arr).size === arr.length, {
            message: 'error:common.seo.keywords.duplicateValues'
        })
        .optional()
});

export type SeoInput = z.infer<typeof SeoSchema>;
