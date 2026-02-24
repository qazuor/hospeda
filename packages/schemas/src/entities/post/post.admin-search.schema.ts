/**
 * Admin Search Schema for Posts
 *
 * Extends the base admin search schema with post-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { PostCategoryEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for posts.
 * Extends base admin search with post-specific filters.
 *
 * @example
 * ```ts
 * const params = PostAdminSearchSchema.parse({
 *   page: 1,
 *   category: 'EVENTS',
 *   isFeatured: true,
 *   isNews: true
 * });
 * ```
 */
export const PostAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by post category */
    category: PostCategoryEnumSchema.optional().describe('Filter by post category'),

    /** Filter by author UUID */
    authorId: z
        .string()
        .uuid({ message: 'zodError.admin.search.post.authorId.uuid' })
        .optional()
        .describe('Filter by author'),

    /** Filter featured posts */
    isFeatured: z.coerce.boolean().optional().describe('Filter by featured status'),

    /** Filter news posts */
    isNews: z.coerce.boolean().optional().describe('Filter news posts'),

    /** Filter by related destination UUID */
    relatedDestinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.post.relatedDestinationId.uuid' })
        .optional()
        .describe('Filter by related destination')
});

/**
 * Type inferred from {@link PostAdminSearchSchema}.
 * Represents the validated admin search parameters for posts.
 */
export type PostAdminSearch = z.infer<typeof PostAdminSearchSchema>;
