import type { PostType } from '@repo/types';
import { PostCategoryEnum, VisibilityEnum } from '@repo/types';
import { z } from 'zod';

import { MediaSchema, SeoSchema } from '../common.schema';

/**
 * Zod schema for updating a post.
 * All fields are optional for PATCH use.
 */
export const PostUpdateSchema: z.ZodType<
    Partial<
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
    >
> = z.object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    slug: z.string().optional(),
    category: z
        .nativeEnum(PostCategoryEnum, {
            required_error: 'error:post.categoryRequired',
            invalid_type_error: 'error:post.categoryInvalid'
        })
        .optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    media: MediaSchema.optional(),

    authorId: z.string().uuid({ message: 'error:post.authorIdInvalid' }).optional(),

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

    visibility: z
        .nativeEnum(VisibilityEnum, {
            required_error: 'error:post.visibilityRequired',
            invalid_type_error: 'error:post.visibilityInvalid'
        })
        .optional(),

    seo: SeoSchema.optional(),

    isFeatured: z.boolean().optional(),
    isNews: z.boolean().optional(),
    isFeaturedInWebsite: z.boolean().optional(),

    expiresAt: z.coerce.date().optional(),

    likes: z.number().int().min(0).optional(),
    comments: z.number().int().min(0).optional(),
    shares: z.number().int().min(0).optional(),

    state: z
        .nativeEnum(VisibilityEnum, {
            required_error: 'error:post.stateRequired',
            invalid_type_error: 'error:post.stateInvalid'
        })
        .optional()
});
