import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';
declare const TagSchema: z.ZodTypeAny;

export const ImageSchema = z.object({
    moderationState: ModerationStatusEnumSchema,
    url: z.string().url({ message: 'zodError.common.media.image.url.invalid' }),
    caption: z
        .string({
            required_error: 'zodError.common.media.image.caption.required',
            invalid_type_error: 'zodError.common.media.image.caption.invalidType'
        })
        .min(3, { message: 'zodError.common.media.image.caption.min' })
        .max(100, { message: 'zodError.common.media.image.caption.max' })
        .optional(),
    description: z
        .string({
            required_error: 'zodError.common.media.image.description.required',
            invalid_type_error: 'zodError.common.media.image.description.invalidType'
        })
        .min(10, { message: 'zodError.common.media.image.description.min' })
        .max(300, { message: 'zodError.common.media.image.description.max' })
        .optional(),
    tags: z.array(z.lazy(() => TagSchema)).optional()
});

export const VideoSchema = z.object({
    moderationState: ModerationStatusEnumSchema,
    url: z.string().url({ message: 'zodError.common.media.video.url.invalid' }),
    caption: z
        .string({
            required_error: 'zodError.common.media.video.caption.required',
            invalid_type_error: 'zodError.common.media.video.caption.invalidType'
        })
        .min(3, { message: 'zodError.common.media.video.caption.min' })
        .max(100, { message: 'zodError.common.media.video.caption.max' })
        .optional(),
    description: z
        .string({
            required_error: 'zodError.common.media.video.description.required',
            invalid_type_error: 'zodError.common.media.video.description.invalidType'
        })
        .min(10, { message: 'zodError.common.media.video.description.min' })
        .max(300, { message: 'zodError.common.media.video.description.max' })
        .optional(),
    tags: z.array(z.lazy(() => TagSchema)).optional()
});

export const MediaSchema = z.object({
    featuredImage: ImageSchema,
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});
