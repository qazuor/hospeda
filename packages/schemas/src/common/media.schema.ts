import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';

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
        .optional()
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
    featuredImage: ImageSchema,
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
        .optional()
} as const;
export type BaseMediaFieldsType = typeof BaseMediaFields;
