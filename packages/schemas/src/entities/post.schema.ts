// export interface PostType extends BaseEntityType {

import { z } from 'zod';
import { BaseEntitySchema, MediaSchema, SeoSchema, TagSchema } from '../common.schema.js';
import { PostCategoryEnumSchema, VisibilityEnumSchema } from '../enums.schema.js';
import { SlugRegex, omittedBaseEntityFieldsForActions } from '../utils/utils.js';
import { PostSponsorshipSchema } from './post/sponsorship.schema.js';

// }

/**
 * Zod schema for a post entity.
 */
export const PostSchema = BaseEntitySchema.extend({
    slug: z
        .string()
        .min(3, 'error:post.slug.min_lenght')
        .max(30, 'error:post.slug.max_lenght')
        .regex(SlugRegex, {
            message: 'error:post.slug.pattern'
        }),
    category: PostCategoryEnumSchema,
    title: z
        .string()
        .min(50, 'error:post.title.min_lenght')
        .max(200, 'error:post.title.max_lenght'),
    summary: z
        .string()
        .min(50, 'error:post.summary.min_lenght')
        .max(200, 'error:post.summary.max_lenght'),
    content: z
        .string()
        .min(50, 'error:post.description.min_lenght')
        .max(1000, 'error:post.description.max_lenght'),
    media: MediaSchema.optional(),
    sponsorship: PostSponsorshipSchema.optional(),
    relatedDestinationId: z
        .string()
        .uuid({ message: 'error:post.relatedDestinationId.invalid' })
        .optional(),
    relatedAccommodationId: z
        .string()
        .uuid({ message: 'error:post.relatedAccommodationId.invalid' })
        .optional(),
    relatedEventId: z.string().uuid({ message: 'error:post.relatedEventId.invalid' }).optional(),
    visibility: VisibilityEnumSchema,
    seo: SeoSchema.optional(),
    isFeatured: z
        .boolean({
            required_error: 'error:post.isFeatured.required',
            invalid_type_error: 'error:post.isFeatured.invalid_type'
        })
        .optional(),
    isNews: z
        .boolean({
            required_error: 'error:post.isNews.required',
            invalid_type_error: 'error:post.isNews.invalid_type'
        })
        .optional(),
    isFeaturedInWebsite: z
        .boolean({
            required_error: 'error:post.isFeaturedInWebsite.required',
            invalid_type_error: 'error:post.isFeaturedInWebsite.invalid_type'
        })
        .optional(),
    tags: z.array(TagSchema).optional(),
    expiresAt: z.coerce
        .date({ required_error: 'error:post.expiresAt.required' })
        .refine(
            (date) => {
                const min = new Date();
                min.setDate(min.getDate() + 1);
                return date < min;
            },
            {
                message: 'error:post.expiresAt.min_value'
            }
        )
        .optional()
});

export type PostInput = z.infer<typeof PostSchema>;

export const PostCreateSchema = PostSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof PostSchema.shape,
        true
    >
);

export const PostUpdateSchema = PostSchema.omit(
    Object.fromEntries(omittedBaseEntityFieldsForActions.map((field) => [field, true])) as Record<
        keyof typeof PostSchema.shape,
        true
    >
).partial();
