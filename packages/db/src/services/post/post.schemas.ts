import type { PostId, PostType } from '@repo/types';
import { z } from 'zod';

/**
 * Input schema for getById.
 *
 * @example
 * const input = { id: 'post-uuid' as PostId };
 */
export const getByIdInputSchema = z.object({
    id: z.string().min(1, 'Post ID is required') as unknown as z.ZodType<PostId>
});

/**
 * Output type for getById.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type GetByIdInput = z.infer<typeof getByIdInputSchema>;
export type GetByIdOutput = { post: PostType | null };

/**
 * Input schema for getBySlug.
 *
 * @example
 * const input = { slug: 'my-post-slug' };
 */
export const getBySlugInputSchema = z.object({
    slug: z.string().min(1, 'Post slug is required')
});

/**
 * Output type for getBySlug.
 *
 * @example
 * const output = { post: postObjectOrNull };
 */
export type GetBySlugInput = z.infer<typeof getBySlugInputSchema>;
export type GetBySlugOutput = { post: PostType | null };

/**
 * Input schema for list.
 *
 * @example
 * const input = { limit: 10, offset: 0 };
 */
export const listInputSchema = z.object({
    q: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    category: z.string().optional(),
    authorId: z.string().optional(),
    lifecycle: z.string().optional(),
    visibility: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    order: z.enum(['asc', 'desc']).optional(),
    orderBy: z.enum(['title', 'createdAt']).optional()
});

/**
 * Input type for list.
 * @example
 * const input: ListInput = { limit: 10, offset: 0 };
 */
export type ListInput = z.infer<typeof listInputSchema>;

/**
 * Output type for list.
 * @example
 * const output: ListOutput = { posts: [mockPost] };
 */
export type ListOutput = { posts: PostType[] };
