import { z } from 'zod';
import { PostSchema } from './post.schema.js';

/**
 * Batch request schema for post operations
 * Used for retrieving multiple posts by their IDs
 *
 * @example
 * ```typescript
 * const request = {
 *   ids: ['post_123', 'post_456', 'post_789'],
 *   fields: ['id', 'title', 'slug', 'publishedAt'] // Optional field selection
 * };
 * ```
 */
export const PostBatchRequestSchema = z.object({
    /**
     * Array of post IDs to retrieve
     * Limited to 100 IDs per request for performance
     */
    ids: z
        .array(z.string().uuid('Invalid post ID format'))
        .min(1, 'At least one post ID is required')
        .max(100, 'Maximum 100 post IDs allowed per request'),

    /**
     * Optional array of field names to include in the response
     * If not provided, all fields will be returned
     * Always includes 'id' and 'title' for entity selectors to work
     */
    fields: z
        .array(z.string())
        .optional()
        .describe('Optional field selection for response optimization')
});

/**
 * Batch response schema for post operations
 * Returns an array of posts or null for missing/inaccessible posts
 *
 * @example
 * ```typescript
 * const response = [
 *   { id: 'post_123', title: 'Sample Post', slug: 'sample-post' },
 *   null, // post not found or not accessible
 *   { id: 'post_789', title: 'Another Post', slug: 'another-post' }
 * ];
 * ```
 */
export const PostBatchResponseSchema = z.array(
    PostSchema.nullable().describe('Post data or null if not found/accessible')
);

// Type exports for TypeScript usage
export type PostBatchRequest = z.infer<typeof PostBatchRequestSchema>;
export type PostBatchResponse = z.infer<typeof PostBatchResponseSchema>;
