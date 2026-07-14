import { z } from 'zod';
import { PostSponsorIdSchema } from '../../common/id.schema.js';
import { BaseSearchSchema } from '../../common/pagination.schema.js';
import { ClientTypeEnumSchema, LifecycleStatusEnumSchema } from '../../enums/index.js';
import { PostSponsorSchema } from './postSponsor.schema.js';

/**
 * PostSponsor CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for post sponsors:
 * - Create (input/output)
 * - Update (input/output)
 * - Search (input/output)
 * - List operations
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new post sponsor
 * Omits auto-generated fields like id and audit fields
 */
export const PostSponsorCreateInputSchema = PostSponsorSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    adminInfo: true,
    lifecycleState: true
})
    .extend({
        // HOS-106: the admin sponsor form submits lifecycleState as an editable
        // field, and `.strict()` now actually enforces request bodies. Re-add it
        // as OPTIONAL (matching the feature-create pattern) rather than inheriting
        // the base `.default(ACTIVE)` — a default would make it required in the
        // inferred type and would reset the state to ACTIVE on any partial update
        // that omits it. Absent on create means the service/DB keeps the prior
        // behavior; the form sends one of DRAFT/ACTIVE/ARCHIVED.
        lifecycleState: LifecycleStatusEnumSchema.optional()
    })
    .strict();

/**
 * Schema for post sponsor creation response
 * Returns the complete post sponsor object
 */
export const PostSponsorCreateOutputSchema = z.object({
    item: PostSponsorSchema
});

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a post sponsor
 * All fields optional except those that shouldn't be updated
 */
// lifecycleState is optional (no default) on create, so `.partial()` stays
// safe — an update that omits it leaves the state unchanged (HOS-106).
export const PostSponsorUpdateInputSchema = PostSponsorCreateInputSchema.partial();

/**
 * Schema for partial post sponsor updates (PATCH)
 * Same as update but explicitly named for clarity
 */
export const PostSponsorPatchInputSchema = PostSponsorUpdateInputSchema;

/**
 * Schema for post sponsor update response
 * Returns the complete updated post sponsor object
 */
export const PostSponsorUpdateOutputSchema = z.object({
    item: PostSponsorSchema
});

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

/**
 * Schema for searching post sponsors
 * Allows filtering by name, type, and free text search
 */
export const PostSponsorSearchInputSchema = BaseSearchSchema.extend({
    name: z
        .string({
            message: 'zodError.postSponsor.search.name.invalidType'
        })
        .min(1, { message: 'zodError.postSponsor.search.name.min' })
        .optional(),
    type: ClientTypeEnumSchema.optional()
});

/**
 * Schema for post sponsor search response
 * Returns paginated list of post sponsors
 */
export const PostSponsorSearchOutputSchema = z.object({
    items: z.array(PostSponsorSchema),
    total: z.number().int().min(0)
});

// ============================================================================
// LIST SCHEMAS
// ============================================================================

/**
 * Schema for post sponsor list response (used by searchForList method)
 * Returns items and total count
 */
export const PostSponsorListOutputSchema = z.object({
    items: z.array(PostSponsorSchema),
    total: z.number().int().min(0)
});

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for post sponsor deletion input
 * Requires ID and optional force flag for hard delete
 */
export const PostSponsorDeleteInputSchema = z.object({
    id: PostSponsorIdSchema,
    force: z
        .boolean({
            message: 'zodError.postSponsor.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for post sponsor deletion response
 * Returns success status
 */
export const PostSponsorDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.postSponsor.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.postSponsor.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for post sponsor restoration input
 * Requires only the post sponsor ID
 */
export const PostSponsorRestoreInputSchema = z.object({
    id: PostSponsorIdSchema
});

/**
 * Schema for post sponsor restoration response
 * Returns the complete restored post sponsor object
 */
export const PostSponsorRestoreOutputSchema = z.object({
    item: PostSponsorSchema
});

// ============================================================================
// VIEW SCHEMAS
// ============================================================================

/**
 * Schema for viewing a single post sponsor
 * Returns the complete post sponsor object
 */
export const PostSponsorViewOutputSchema = z.object({
    item: PostSponsorSchema.nullable()
});

// ============================================================================
// COUNT SCHEMAS
// ============================================================================

/**
 * Schema for post sponsor count response
 * Returns the count of matching sponsors
 */
export const PostSponsorCountOutputSchema = z.object({
    count: z.number().int().min(0)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PostSponsorCreateInput = z.infer<typeof PostSponsorCreateInputSchema>;
export type PostSponsorCreateOutput = z.infer<typeof PostSponsorCreateOutputSchema>;
export type PostSponsorUpdateInput = z.infer<typeof PostSponsorUpdateInputSchema>;
export type PostSponsorPatchInput = z.infer<typeof PostSponsorPatchInputSchema>;
export type PostSponsorUpdateOutput = z.infer<typeof PostSponsorUpdateOutputSchema>;
export type PostSponsorSearchInput = z.infer<typeof PostSponsorSearchInputSchema>;
export type PostSponsorSearchOutput = z.infer<typeof PostSponsorSearchOutputSchema>;
export type PostSponsorListOutput = z.infer<typeof PostSponsorListOutputSchema>;
export type PostSponsorDeleteInput = z.infer<typeof PostSponsorDeleteInputSchema>;
export type PostSponsorDeleteOutput = z.infer<typeof PostSponsorDeleteOutputSchema>;
export type PostSponsorRestoreInput = z.infer<typeof PostSponsorRestoreInputSchema>;
export type PostSponsorRestoreOutput = z.infer<typeof PostSponsorRestoreOutputSchema>;
export type PostSponsorViewOutput = z.infer<typeof PostSponsorViewOutputSchema>;
export type PostSponsorCountOutput = z.infer<typeof PostSponsorCountOutputSchema>;
