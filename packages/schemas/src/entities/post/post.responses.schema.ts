import { z } from 'zod';
import { PostSchema } from './post.schema.js';

export const PostListItemSchema = PostSchema.pick({
    id: true,
    slug: true,
    title: true,
    category: true,
    media: true,
    isFeatured: true,
    isNews: true,
    createdAt: true
});

export const PostDetailSchema = PostSchema;

export const PostSummarySchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        category: z.string(),
        media: z.any().optional(),
        isFeatured: z.boolean(),
        isNews: z.boolean(),
        createdAt: z.any(),
        authorId: z.string(),
        summary: z.string()
    })
    .strict();

export const PostStatsSchema = z
    .object({
        likes: z.number().int(),
        comments: z.number().int(),
        shares: z.number().int()
    })
    .strict();
