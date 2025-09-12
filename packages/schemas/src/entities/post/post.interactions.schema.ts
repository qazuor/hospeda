import { z } from 'zod';
import { PostIdSchema } from '../../common/id.schema.js';

/**
 * Post Interactions Schemas
 *
 * This file contains schemas related to post interactions:
 * - Like/Unlike operations
 * - Comment operations
 * - Social engagement actions
 */

// ============================================================================
// LIKE/UNLIKE SCHEMAS
// ============================================================================

/**
 * Schema for liking/unliking a post
 * Requires only the post ID
 */
export const LikePostInputSchema = z
    .object({
        postId: PostIdSchema
    })
    .strict();

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

/**
 * Schema for adding a comment to a post
 * Currently a stub - not fully implemented
 */
export const AddPostCommentInputSchema = z
    .object({
        postId: PostIdSchema,
        comment: z.string().min(1).max(1000)
    })
    .strict();

/**
 * Schema for removing a comment from a post
 * Currently a stub - not fully implemented
 */
export const RemovePostCommentInputSchema = z
    .object({
        postId: PostIdSchema,
        commentId: z.string().uuid()
    })
    .strict();

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type LikePostInput = z.infer<typeof LikePostInputSchema>;
export type AddPostCommentInput = z.infer<typeof AddPostCommentInputSchema>;
export type RemovePostCommentInput = z.infer<typeof RemovePostCommentInputSchema>;
