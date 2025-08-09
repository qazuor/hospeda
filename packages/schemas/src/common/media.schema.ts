import { z } from 'zod';
import { ModerationStatusEnumSchema } from '../enums/index.js';

/**
 * Lazy reference to resolve circular dependency between TagSchema and MediaSchema.
 *
 * Problem: TagSchema imports MediaSchema (through accommodation schema -> media schema),
 * and MediaSchema needs TagSchema for the tags array. This creates a circular dependency.
 *
 * Solution: Use z.lazy() to defer TagSchema resolution until runtime, breaking the
 * circular import chain at module load time. The function will be called only when
 * the schema is actually used for validation.
 */
let tagSchemaCache: z.ZodTypeAny | undefined;
const getTagSchema = (): z.ZodTypeAny => {
    if (tagSchemaCache === undefined) {
        // Use dynamic import at runtime to break circular dependency
        const tagModule = require('../entities/tag/tag.schema.js');
        tagSchemaCache = tagModule.TagSchema as z.ZodTypeAny;
    }
    return tagSchemaCache as z.ZodTypeAny;
};

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
    tags: z.array(z.lazy(() => getTagSchema())).optional()
});

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
        .optional(),
    tags: z.array(z.lazy(() => getTagSchema())).optional()
});

export const MediaSchema = z.object({
    featuredImage: ImageSchema,
    gallery: z.array(ImageSchema).optional(),
    videos: z.array(VideoSchema).optional()
});
