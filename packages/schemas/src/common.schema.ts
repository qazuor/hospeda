import { z } from 'zod';

import {
    PreferedContactEnumSchema,
    PriceCurrencyEnumSchema,
    StateEnumSchema
} from './enums.schema';

/**
 * Schema for geographic coordinates.
 */
export const CoordinatesSchema = z.object({
    lat: z.string().min(1, {
        message: 'error:coordinates.latRequired'
    }),
    long: z.string().min(1, {
        message: 'error:coordinates.longRequired'
    })
});

/**
 * Schema for full location address including optional geo metadata.
 */
export const LocationSchema = z.object({
    street: z.string().min(1, {
        message: 'error:location.streetRequired'
    }),
    neighborhood: z.string().optional(),
    city: z.string().min(1, {
        message: 'error:location.cityRequired'
    }),
    state: z.string().min(1, {
        message: 'error:location.stateRequired'
    }),
    zipCode: z.string().optional(),
    country: z.string().min(1, {
        message: 'error:location.countryRequired'
    }),
    placeName: z.string().optional(),
    coordinates: CoordinatesSchema
});

/**
 * Schema for user or business contact information.
 */
export const ContactInfoSchema = z.object({
    personalEmail: z.string().email({
        message: 'error:contact.personalEmailInvalid'
    }),
    workEmail: z
        .string()
        .email({
            message: 'error:contact.workEmailInvalid'
        })
        .optional(),
    homePhone: z.string().optional(),
    workPhone: z.string().optional(),
    mobilePhone: z.string().min(1, {
        message: 'error:contact.mobilePhoneRequired'
    }),
    preferredEmail: PreferedContactEnumSchema,
    preferredPhone: PreferedContactEnumSchema
});

/**
 * Schema for social media links with platform-specific validation patterns.
 */
export const SocialNetworkSchema = z.object({
    facebook: z
        .string()
        .url()
        .regex(/^https:\/\/(www\.)?facebook\.com\/[A-Za-z0-9.]+$/, {
            message: 'error:social.facebookInvalid'
        })
        .optional(),

    twitter: z
        .string()
        .url()
        .regex(/^https:\/\/(www\.)?twitter\.com\/[A-Za-z0-9_]+$/, {
            message: 'error:social.twitterInvalid'
        })
        .optional(),

    instagram: z
        .string()
        .url()
        .regex(/^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+$/, {
            message: 'error:social.instagramInvalid'
        })
        .optional(),

    linkedIn: z
        .string()
        .url()
        .regex(/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+$/, {
            message: 'error:social.linkedinInvalid'
        })
        .optional(),

    website: z
        .string()
        .url({
            message: 'error:social.websiteInvalid'
        })
        .optional()
});

/**
 * Schema for price with optional amount and standardized currency.
 */
export const BasePriceSchema = z.object({
    price: z.number().nonnegative().optional(),
    currency: PriceCurrencyEnumSchema.optional()
});

/**
 * Schema for image media including metadata and tags.
 */
export const ImageSchema = z.object({
    url: z.string().url({
        message: 'error:image.urlInvalid'
    }),
    caption: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    state: StateEnumSchema
});

/**
 * Schema for video content.
 */
export const VideoSchema = z.object({
    url: z.string().url({
        message: 'error:video.urlInvalid'
    }),
    caption: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    state: StateEnumSchema
});

/**
 * SEO fields for content optimization.
 */
export const SeoSchema = z.object({
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.array(z.string()).optional()
});

/**
 * Metadata used by administrators only.
 */
export const AdminInfoSchema = z.object({
    notes: z.string().max(1000, {
        message: 'error:admin.notesTooLong'
    }),
    favorite: z.boolean(),
    tags: z.array(z.string())
});

/**
 * Reusable base schema for audit and metadata in main entities.
 */
export const BaseEntitySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    displayName: z.string().min(1),
    state: StateEnumSchema,
    createdAt: z.date(),
    createdBy: z.string().uuid(),
    updatedAt: z.date(),
    updatedBy: z.string().uuid(),
    deletedAt: z.date().optional(),
    deletedBy: z.string().uuid().optional()
});

/**
 * Schema representing all media content (images, videos).
 */
export const MediaSchema = z.object({
    featuredImage: ImageSchema,
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});
