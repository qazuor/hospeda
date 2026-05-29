import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';

/**
 * Optional attribution metadata for images sourced from third parties
 * (stock photo services, contributed photography, licensed archives).
 *
 * Added by SPEC-078-GAPS (GAP-078-116) as an optional, additive extension
 * to `ImageSchema`. All fields are optional so historic payloads without
 * attribution keep parsing.
 */
export const ImageAttributionSchema = z.object({
    photographer: z
        .string()
        .min(1, { message: 'zodError.common.media.image.attribution.photographer.min' })
        .max(200, { message: 'zodError.common.media.image.attribution.photographer.max' })
        .optional(),
    sourceUrl: z
        .string()
        .url({ message: 'zodError.common.media.image.attribution.sourceUrl.invalid' })
        .optional(),
    license: z
        .string()
        .min(1, { message: 'zodError.common.media.image.attribution.license.min' })
        .max(200, { message: 'zodError.common.media.image.attribution.license.max' })
        .optional()
});
export type ImageAttribution = z.infer<typeof ImageAttributionSchema>;

export const ImageSchema = z.object({
    moderationState: ModerationStatusEnumSchema,
    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
    caption: z
        .string({
            message: 'zodError.common.media.image.caption.required'
        })
        .min(3, { message: 'zodError.common.media.image.caption.min' })
        .max(100, { message: 'zodError.common.media.image.caption.max' })
        .optional(),
    description: z
        .string({
            message: 'zodError.common.media.image.description.required'
        })
        .min(10, { message: 'zodError.common.media.image.description.min' })
        .max(300, { message: 'zodError.common.media.image.description.max' })
        .optional(),
    /**
     * Accessible alt text for screen readers and `<img alt>` attribute. The
     * admin `ImageField` populates this on upload (from the filename) and
     * exposes an editable input so authors can override it. Kept short and
     * meaningful; falls back to caption / accommodation name when missing.
     */
    alt: z
        .string()
        .min(1, { message: 'zodError.common.media.image.alt.min' })
        .max(200, { message: 'zodError.common.media.image.alt.max' })
        .optional(),
    /**
     * Cloudinary `public_id` for the uploaded asset (e.g. `hospeda/dev/x`).
     * Optional because historic payloads pre-SPEC-078 and external URLs
     * (Unsplash, Pexels) do not carry a Cloudinary identifier.
     *
     * Added by SPEC-078-GAPS (GAP-078-196).
     */
    publicId: z.string().min(1, { message: 'zodError.common.media.image.publicId.min' }).optional(),
    /**
     * Optional credits/source metadata (photographer, source URL, license).
     * Added by SPEC-078-GAPS (GAP-078-116).
     */
    attribution: ImageAttributionSchema.optional()
});
export type Image = z.infer<typeof ImageSchema>;

export const VideoSchema = z.object({
    moderationState: ModerationStatusEnumSchema,
    url: z.string().url({ message: 'zodError.common.media.video.url.invalid' }),
    caption: z
        .string({
            message: 'zodError.common.media.video.caption.required'
        })
        .min(3, { message: 'zodError.common.media.video.caption.min' })
        .max(100, { message: 'zodError.common.media.video.caption.max' })
        .optional(),
    description: z
        .string({
            message: 'zodError.common.media.video.description.required'
        })
        .min(10, { message: 'zodError.common.media.video.description.min' })
        .max(300, { message: 'zodError.common.media.video.description.max' })
        .optional()
});
export type Video = z.infer<typeof VideoSchema>;

export const MediaSchema = z.object({
    /**
     * Featured image. Optional as of SPEC-078-GAPS (GAP-078-185) to align
     * with `BaseMediaFields.media.featuredImage` below. Historic payloads
     * that always populated `featuredImage` still parse because a valid
     * `Image` is also a valid "present optional".
     */
    featuredImage: ImageSchema.optional(),
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});
export type Media = z.infer<typeof MediaSchema>;

/**
 * Base media fields (standardized with caption, description, and moderationState)
 */
export const BaseMediaFields = {
    media: z
        .object({
            featuredImage: z
                .object({
                    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
                    caption: z
                        .string()
                        .min(3, { message: 'zodError.common.media.image.caption.min' })
                        .max(100, { message: 'zodError.common.media.image.caption.max' })
                        .optional(),
                    description: z
                        .string()
                        .min(10, { message: 'zodError.common.media.image.description.min' })
                        .max(300, { message: 'zodError.common.media.image.description.max' })
                        .optional(),
                    alt: z
                        .string()
                        .min(1, { message: 'zodError.common.media.image.alt.min' })
                        .max(200, { message: 'zodError.common.media.image.alt.max' })
                        .optional(),
                    moderationState: ModerationStatusEnumSchema
                })
                .optional(),
            gallery: z
                .array(
                    z.object({
                        url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
                        caption: z
                            .string()
                            .min(3, { message: 'zodError.common.media.image.caption.min' })
                            .max(100, { message: 'zodError.common.media.image.caption.max' })
                            .optional(),
                        description: z
                            .string()
                            .min(10, { message: 'zodError.common.media.image.description.min' })
                            .max(300, { message: 'zodError.common.media.image.description.max' })
                            .optional(),
                        alt: z
                            .string()
                            .min(1, { message: 'zodError.common.media.image.alt.min' })
                            .max(200, { message: 'zodError.common.media.image.alt.max' })
                            .optional(),
                        moderationState: ModerationStatusEnumSchema
                    })
                )
                .optional(),
            videos: z
                .array(
                    z.object({
                        url: z.string().url({ message: 'zodError.common.media.video.url.invalid' }),
                        caption: z
                            .string()
                            .min(3, { message: 'zodError.common.media.video.caption.min' })
                            .max(100, { message: 'zodError.common.media.video.caption.max' })
                            .optional(),
                        description: z
                            .string()
                            .min(10, { message: 'zodError.common.media.video.description.min' })
                            .max(300, { message: 'zodError.common.media.video.description.max' })
                            .optional(),
                        moderationState: ModerationStatusEnumSchema
                    })
                )
                .optional()
        })
        .nullish()
} as const;
export type BaseMediaFieldsType = typeof BaseMediaFields;
