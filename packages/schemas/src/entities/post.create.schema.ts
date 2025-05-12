import type { PostType } from '@repo/types';
import { PostCategoryEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { MediaSchema, SeoSchema } from '../common.schema';

/**
 * Zod schema for creating a new post.
 */
export const PostCreateSchema: z.ZodType<
    Omit<
        PostType,
        | 'id'
        | 'createdAt'
        | 'createdById'
        | 'updatedAt'
        | 'updatedById'
        | 'deletedAt'
        | 'deletedById'
    >
> = z.object({
    name: z.string({ required_error: 'error:post.nameRequired' }),
    displayName: z.string({ required_error: 'error:post.displayNameRequired' }),
    slug: z.string({ required_error: 'error:post.slugRequired' }),
    category: z.nativeEnum(PostCategoryEnum, {
        required_error: 'error:post.categoryRequired',
        invalid_type_error: 'error:post.categoryInvalid'
    }),
    title: z.string({ required_error: 'error:post.titleRequired' }),
    summary: z.string({ required_error: 'error:post.summaryRequired' }),
    content: z.string({ required_error: 'error:post.contentRequired' }),
    media: MediaSchema,

    authorId: z.string().uuid({ message: 'error:post.authorIdInvalid' }),

    sponsorshipId: z.string().uuid({ message: 'error:post.sponsorshipIdInvalid' }).optional(),

    relatedDestinationId: z
        .string()
        .uuid({ message: 'error:post.relatedDestinationIdInvalid' })
        .optional(),
    relatedAccommodationId: z
        .string()
        .uuid({ message: 'error:post.relatedAccommodationIdInvalid' })
        .optional(),
    relatedEventId: z.string().uuid({ message: 'error:post.relatedEventIdInvalid' }).optional(),

    visibility: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:post.visibilityRequired',
        invalid_type_error: 'error:post.visibilityInvalid'
    }),

    seo: SeoSchema.optional(),

    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),

    expiresAt: z.coerce.date().optional(),

    likes: z.number().int().min(0).optional(),
    comments: z.number().int().min(0).optional(),
    shares: z.number().int().min(0).optional(),

    state: z.nativeEnum(VisibilityEnum, {
        required_error: 'error:post.stateRequired',
        invalid_type_error: 'error:post.stateInvalid'
    })
});
