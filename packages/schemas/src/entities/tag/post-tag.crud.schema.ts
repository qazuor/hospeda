import { z } from 'zod';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { PostTagSchema } from './post-tag.schema.js';

/**
 * PostTag CRUD Schemas
 *
 * Create, update, delete, and restore operations for the `post_tags` table.
 *
 * PostTags are managed exclusively by editors and admins. Unlike user-tags,
 * there are no ownership invariants on create — all PostTags are global.
 *
 * @see D-001, D-013, D-018 in SPEC-086 decisions.md
 * @see POST_TAG_CREATE, POST_TAG_UPDATE, POST_TAG_DELETE permissions (D-017)
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Schema for creating a new PostTag.
 *
 * Required: `name`, `slug` (lowercase URL-safe), `color`.
 * Optional: `icon`, `description`, `lifecycleState` (defaults to ACTIVE).
 *
 * The `slug` must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` — lowercase alphanumerics
 * and hyphens only. Validated at parse time; uniqueness enforced by DB index.
 *
 * @example
 * ```ts
 * CreatePostTagSchema.parse({ name: 'Gastronomía', slug: 'gastronomia', color: 'ORANGE' });
 * CreatePostTagSchema.parse({ name: 'Guía de viaje', slug: 'guia-de-viaje', color: 'BLUE' });
 * ```
 */
export const CreatePostTagSchema = PostTagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    lifecycleState: true
}).extend({
    /**
     * Lifecycle state defaults to ACTIVE for new PostTags.
     * Editors may set DRAFT if they want to prepare without publishing.
     */
    lifecycleState: LifecycleStatusEnumSchema.optional().default(LifecycleStatusEnum.ACTIVE)
});

/**
 * Schema for PostTag creation response.
 * Returns the complete PostTag object.
 */
export const CreatePostTagOutputSchema = PostTagSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a PostTag (PATCH — all fields patchable).
 *
 * Unlike user-tags, PostTag `type` does not exist, so there is no immutability
 * concern. All fields including `slug` can be changed by an admin.
 *
 * Note: uniqueness of `name` and `slug` is enforced at the DB / service layer.
 *
 * @example
 * ```ts
 * UpdatePostTagSchema.parse({ name: 'Gastronomía regional' });
 * UpdatePostTagSchema.parse({ slug: 'gastronomia-regional', color: 'GREEN' });
 * ```
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const UpdatePostTagSchema = z
    .object(stripShapeDefaults(CreatePostTagSchema.shape))
    .partial();

/**
 * Schema for PostTag update response.
 * Returns the complete updated PostTag object.
 */
export const UpdatePostTagOutputSchema = PostTagSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for PostTag deletion input.
 *
 * PostTags use hard delete with cascade on `r_post_post_tag` (D-011).
 * A confirmation impact count endpoint should be called first (D-011).
 */
export const DeletePostTagInputSchema = z.object({
    id: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Schema for PostTag deletion response.
 */
export const DeletePostTagOutputSchema = z.object({
    success: z.boolean().default(true),
    deletedAt: z.date().optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for PostTag restoration input.
 */
export const RestorePostTagInputSchema = z.object({
    id: z
        .string({
            message: 'zodError.common.id.required'
        })
        .uuid({ message: 'zodError.common.id.invalidUuid' })
});

/**
 * Schema for PostTag restoration response.
 */
export const RestorePostTagOutputSchema = PostTagSchema;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CreatePostTagInput = z.infer<typeof CreatePostTagSchema>;
export type CreatePostTagOutput = z.infer<typeof CreatePostTagOutputSchema>;
export type UpdatePostTagInput = z.infer<typeof UpdatePostTagSchema>;
export type UpdatePostTagOutput = z.infer<typeof UpdatePostTagOutputSchema>;
export type DeletePostTagInput = z.infer<typeof DeletePostTagInputSchema>;
export type DeletePostTagOutput = z.infer<typeof DeletePostTagOutputSchema>;
export type RestorePostTagInput = z.infer<typeof RestorePostTagInputSchema>;
export type RestorePostTagOutput = z.infer<typeof RestorePostTagOutputSchema>;
