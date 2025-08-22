import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    PostCategoryEnum,
    VisibilityEnum
} from '@repo/types';
import { z } from 'zod';

export const PostListItemSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        excerpt: z.string().optional(),
        authorId: z.string().nullable().optional(),
        authorName: z.string().optional(),
        destinationId: z.string().nullable().optional(),
        destinationName: z.string().optional(),
        postType: z.nativeEnum(PostCategoryEnum).optional(),
        publishedAt: z.string().optional(),
        readingTime: z.number().optional(),
        viewsCount: z.number().optional(),
        likesCount: z.number().optional(),
        commentsCount: z.number().optional(),
        isFeatured: z.boolean().optional(),
        visibility: z.nativeEnum(VisibilityEnum).optional(),
        lifecycleState: z.nativeEnum(LifecycleStatusEnum).optional(),
        moderationState: z.nativeEnum(ModerationStatusEnum).optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        tags: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional()
    })
    .passthrough();

export type Post = z.infer<typeof PostListItemSchema>;
