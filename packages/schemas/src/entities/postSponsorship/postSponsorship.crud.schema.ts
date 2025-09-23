import { z } from 'zod';
import {
    PostIdSchema,
    PostSponsorIdSchema,
    PostSponsorshipIdSchema
} from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { PostSponsorshipSchema } from './postSponsorship.schema.js';

/**
 * PostSponsorship CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for post sponsorships:
 * - Create (input/output)
 * - Update (input/output)
 * - Search (input/output)
 * - List operations
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new post sponsorship
 * Omits auto-generated fields like id and audit fields
 * Allows lifecycleState as optional
 */
export const PostSponsorshipCreateInputSchema = PostSponsorshipSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true
}).strict();

/**
 * Schema for post sponsorship creation response
 * Returns the complete post sponsorship object
 */
export const PostSponsorshipCreateOutputSchema = z.object({
    item: PostSponsorshipSchema
});

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a post sponsorship
 * All fields optional except those that shouldn't be updated
 */
export const PostSponsorshipUpdateInputSchema = PostSponsorshipCreateInputSchema.partial();

/**
 * Schema for post sponsorship update response
 * Returns the complete updated post sponsorship object
 */
export const PostSponsorshipUpdateOutputSchema = z.object({
    item: PostSponsorshipSchema
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching post sponsorships
 * Allows filtering by sponsor, post, dates, and highlight status
 */
export const PostSponsorshipSearchInputSchema = BaseSearchSchema.extend({
    sponsorId: PostSponsorIdSchema.optional(),
    postId: PostIdSchema.optional(),
    fromDate: z
        .string({
            message: 'zodError.postSponsorship.search.fromDate.invalidType'
        })
        .optional(),
    toDate: z
        .string({
            message: 'zodError.postSponsorship.search.toDate.invalidType'
        })
        .optional(),
    isHighlighted: z
        .boolean({
            message: 'zodError.postSponsorship.search.isHighlighted.invalidType'
        })
        .optional()
});

/**
 * Schema for post sponsorship search response
 * Returns paginated list of post sponsorships
 */
export const PostSponsorshipSearchOutputSchema = z.object({
    items: z.array(PostSponsorshipSchema),
    total: z.number().int().min(0)
});

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for post sponsorship deletion input
 * Requires ID and optional force flag for hard delete
 */
export const PostSponsorshipDeleteInputSchema = z.object({
    id: PostSponsorshipIdSchema,
    force: z
        .boolean({
            message: 'zodError.postSponsorship.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for post sponsorship deletion response
 * Returns success status
 */
export const PostSponsorshipDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.postSponsorship.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.postSponsorship.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for post sponsorship restoration input
 * Requires only the post sponsorship ID
 */
export const PostSponsorshipRestoreInputSchema = z.object({
    id: PostSponsorshipIdSchema
});

/**
 * Schema for post sponsorship restoration response
 * Returns the complete restored post sponsorship object
 */
export const PostSponsorshipRestoreOutputSchema = z.object({
    item: PostSponsorshipSchema
});

// ============================================================================
// VIEW SCHEMAS
// ============================================================================

/**
 * Schema for viewing a single post sponsorship
 * Returns the complete post sponsorship object
 */
export const PostSponsorshipViewOutputSchema = z.object({
    item: PostSponsorshipSchema.nullable()
});

// ============================================================================
// COUNT SCHEMAS
// ============================================================================

/**
 * Schema for post sponsorship count response
 * Returns the count of matching sponsorships
 */
export const PostSponsorshipCountOutputSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostSponsorshipCreateInput = z.infer<typeof PostSponsorshipCreateInputSchema>;
export type PostSponsorshipCreateOutput = z.infer<typeof PostSponsorshipCreateOutputSchema>;
export type PostSponsorshipUpdateInput = z.infer<typeof PostSponsorshipUpdateInputSchema>;
export type PostSponsorshipUpdateOutput = z.infer<typeof PostSponsorshipUpdateOutputSchema>;
export type PostSponsorshipSearchInput = z.infer<typeof PostSponsorshipSearchInputSchema>;
export type PostSponsorshipSearchOutput = z.infer<typeof PostSponsorshipSearchOutputSchema>;
export type PostSponsorshipDeleteInput = z.infer<typeof PostSponsorshipDeleteInputSchema>;
export type PostSponsorshipDeleteOutput = z.infer<typeof PostSponsorshipDeleteOutputSchema>;
export type PostSponsorshipRestoreInput = z.infer<typeof PostSponsorshipRestoreInputSchema>;
export type PostSponsorshipRestoreOutput = z.infer<typeof PostSponsorshipRestoreOutputSchema>;
export type PostSponsorshipViewOutput = z.infer<typeof PostSponsorshipViewOutputSchema>;
export type PostSponsorshipCountOutput = z.infer<typeof PostSponsorshipCountOutputSchema>;
