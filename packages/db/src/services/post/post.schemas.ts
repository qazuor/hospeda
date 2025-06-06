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
