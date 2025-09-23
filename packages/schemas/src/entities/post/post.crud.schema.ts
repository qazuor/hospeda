import { z } from 'zod';
import { PostIdSchema } from '../../common/id.schema.js';
import { PostSchema } from './post.schema.js';

/**
 * Post CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for posts:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 * - Publish/Unpublish (input/output)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new post
 * Omits auto-generated fields like id and audit fields
 * Makes slug optional as it can be auto-generated from title
 */
export const PostCreateInputSchema = PostSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).extend({
    slug: z.string().min(1, { message: 'zodError.post.slug.min' }).optional()
});

/**
 * Schema for post creation response
 * Returns the complete post object
 */
export const PostCreateOutputSchema = PostSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a post (PUT - complete replacement)
 * Omits auto-generated fields and makes all fields partial
 */
export const PostUpdateInputSchema = PostSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true
}).partial();

/**
 * Schema for partial post updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const PostPatchInputSchema = PostUpdateInputSchema;

/**
 * Schema for post update response
 * Returns the complete updated post object
 */
export const PostUpdateOutputSchema = PostSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for post deletion input
 * Requires ID and optional force flag for hard delete
 */
export const PostDeleteInputSchema = z.object({
    id: PostIdSchema,
    force: z
        .boolean({
            message: 'zodError.post.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for post deletion response
 * Returns success status and deletion timestamp
 */
export const PostDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.post.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.post.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for post restoration input
 * Requires only the post ID
 */
export const PostRestoreInputSchema = z.object({
    id: PostIdSchema
});

/**
 * Schema for post restoration response
 * Returns the complete restored post object
 */
export const PostRestoreOutputSchema = PostSchema;

// ============================================================================
// PUBLISH/UNPUBLISH SCHEMAS
// ============================================================================

/**
 * Schema for post publish input
 * Requires post ID and optional publish date
 */
export const PostPublishInputSchema = z.object({
    id: PostIdSchema,
    publishedAt: z
        .date({
            message: 'zodError.post.publish.publishedAt.invalidType'
        })
        .optional()
});

/**
 * Schema for post unpublish input
 * Requires only the post ID
 */
export const PostUnpublishInputSchema = z.object({
    id: PostIdSchema
});

/**
 * Schema for post publish/unpublish response
 * Returns the updated post object
 */
export const PostPublishOutputSchema = PostSchema;

// ============================================================================
// FEATURE TOGGLE SCHEMAS
// ============================================================================

/**
 * Schema for post feature toggle input
 * Requires post ID and feature status
 */
export const PostFeatureToggleInputSchema = z.object({
    id: PostIdSchema,
    isFeatured: z.boolean({
        message: 'zodError.post.featureToggle.isFeatured.required'
    })
});

/**
 * Schema for post feature toggle response
 * Returns the updated post object
 */
export const PostFeatureToggleOutputSchema = PostSchema;

// ============================================================================
// DUPLICATE SCHEMAS
// ============================================================================

/**
 * Schema for post duplication input
 * Requires post ID and optional new title
 */
export const PostDuplicateInputSchema = z.object({
    id: PostIdSchema,
    title: z
        .string({
            message: 'zodError.post.duplicate.title.invalidType'
        })
        .min(1, { message: 'zodError.post.duplicate.title.min' })
        .max(200, { message: 'zodError.post.duplicate.title.max' })
        .optional(),
    slug: z
        .string({
            message: 'zodError.post.duplicate.slug.invalidType'
        })
        .min(1, { message: 'zodError.post.duplicate.slug.min' })
        .max(200, { message: 'zodError.post.duplicate.slug.max' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.post.duplicate.slug.pattern'
        })
        .optional(),
    isDraft: z
        .boolean({
            message: 'zodError.post.duplicate.isDraft.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for post duplication response
 * Returns the new duplicated post object
 */
export const PostDuplicateOutputSchema = PostSchema;

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk post operations input
 * Requires array of post IDs and operation type
 */
export const PostBulkOperationInputSchema = z.object({
    ids: z
        .array(PostIdSchema, {
            message: 'zodError.post.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.post.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.post.bulkOperation.ids.max' }),
    operation: z.enum(['delete', 'restore', 'publish', 'unpublish', 'feature', 'unfeature'], {
        message: 'zodError.post.bulkOperation.operation.enum'
    }),
    force: z
        .boolean({
            message: 'zodError.post.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false),
    publishedAt: z
        .date({
            message: 'zodError.post.bulkOperation.publishedAt.invalidType'
        })
        .optional()
});

/**
 * Schema for bulk post operations response
 * Returns operation results for each post
 */
export const PostBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.post.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: PostIdSchema,
            success: z.boolean(),
            error: z.string().optional()
        })
    ),
    summary: z.object({
        total: z.number().int().min(0),
        successful: z.number().int().min(0),
        failed: z.number().int().min(0)
    })
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostCreateInput = z.infer<typeof PostCreateInputSchema>;
export type PostCreateOutput = z.infer<typeof PostCreateOutputSchema>;
export type PostUpdateInput = z.infer<typeof PostUpdateInputSchema>;
export type PostPatchInput = z.infer<typeof PostPatchInputSchema>;
export type PostUpdateOutput = z.infer<typeof PostUpdateOutputSchema>;
export type PostDeleteInput = z.infer<typeof PostDeleteInputSchema>;
export type PostDeleteOutput = z.infer<typeof PostDeleteOutputSchema>;
export type PostRestoreInput = z.infer<typeof PostRestoreInputSchema>;
export type PostRestoreOutput = z.infer<typeof PostRestoreOutputSchema>;
export type PostPublishInput = z.infer<typeof PostPublishInputSchema>;
export type PostUnpublishInput = z.infer<typeof PostUnpublishInputSchema>;
export type PostPublishOutput = z.infer<typeof PostPublishOutputSchema>;
export type PostFeatureToggleInput = z.infer<typeof PostFeatureToggleInputSchema>;
export type PostFeatureToggleOutput = z.infer<typeof PostFeatureToggleOutputSchema>;
export type PostDuplicateInput = z.infer<typeof PostDuplicateInputSchema>;
export type PostDuplicateOutput = z.infer<typeof PostDuplicateOutputSchema>;
export type PostBulkOperationInput = z.infer<typeof PostBulkOperationInputSchema>;
export type PostBulkOperationOutput = z.infer<typeof PostBulkOperationOutputSchema>;
