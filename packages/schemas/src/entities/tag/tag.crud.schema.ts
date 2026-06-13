import { z } from 'zod';
import { TagIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnum } from '../../enums/lifecycle-state.enum.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagTypeSchema } from '../../enums/tag-type.schema.js';
import { stripShapeDefaults } from '../../utils/utils.js';
import { TagSchema } from './tag.schema.js';

/**
 * Tag CRUD Schemas
 *
 * This file contains all schemas related to CRUD operations for tags:
 * - Create (input/output)
 * - Update (input/output)
 * - Patch (input)
 * - Delete (input/output)
 * - Restore (input/output)
 *
 * Design invariants per D-002, D-018 (SPEC-086):
 * - USER tags require `ownerId`.
 * - INTERNAL/SYSTEM tags must NOT have `ownerId`.
 * - `type` is immutable after creation — excluded from all update schemas.
 */

// ============================================================================
// CREATE SCHEMAS
// ============================================================================

/**
 * Base for create input — omits auto-generated fields, type, and ownerId.
 * The conditional refinement on ownerId is applied at the TagCreateInputSchema level.
 */
const TagCreateBaseSchema = TagSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdById: true,
    updatedById: true,
    deletedAt: true,
    deletedById: true,
    type: true,
    ownerId: true,
    lifecycleState: true
}).extend({
    /**
     * Lifecycle state defaults to ACTIVE for new tags.
     * Can be overridden to DRAFT or ARCHIVED.
     */
    lifecycleState: LifecycleStatusEnumSchema.optional().default(LifecycleStatusEnum.ACTIVE)
});

/**
 * Schema for creating a new tag.
 *
 * Required: `type`, `name`, `color`.
 * Optional: `icon`, `description`, `lifecycleState` (defaults to ACTIVE).
 * Conditional (D-002, D-018):
 * - `ownerId` is **required** when `type === 'USER'`.
 * - `ownerId` must be **null or absent** when `type` is `'SYSTEM'` or `'INTERNAL'`.
 *
 * @example
 * ```ts
 * // USER tag — ownerId required
 * TagCreateInputSchema.parse({ type: 'USER', name: 'Check later', color: 'BLUE', ownerId: '<uuid>' });
 *
 * // SYSTEM tag — ownerId must be absent or null
 * TagCreateInputSchema.parse({ type: 'SYSTEM', name: 'Featured', color: 'GREY' });
 * ```
 */
export const TagCreateInputSchema = TagCreateBaseSchema.extend({
    /** Tag type tier. Immutable after creation (D-002). */
    type: TagTypeSchema,
    /**
     * UUID of the tag owner. Required for USER tags; must be null/absent for
     * INTERNAL and SYSTEM tags. Cascade-deleted when the user is deleted (D-004).
     */
    ownerId: UserIdSchema.nullable().optional()
})
    .refine(
        (data) => {
            if (data.type === 'USER') {
                return data.ownerId != null;
            }
            return true;
        },
        {
            message:
                'ownerId is required for USER tags (D-002). Provide a valid UUID that identifies the tag owner.',
            path: ['ownerId']
        }
    )
    .refine(
        (data) => {
            if (data.type === 'INTERNAL' || data.type === 'SYSTEM') {
                return data.ownerId == null;
            }
            return true;
        },
        {
            message:
                'ownerId must be null or absent for INTERNAL and SYSTEM tags (D-002). These tag types are not owned by a specific user.',
            path: ['ownerId']
        }
    );

/**
 * Schema for tag creation response.
 * Returns the complete tag object.
 */
export const TagCreateOutputSchema = TagSchema;

// ============================================================================
// UPDATE SCHEMAS
// ============================================================================

/**
 * Schema for updating a tag (PATCH — partial update).
 *
 * `type` is **immutable** after creation and is excluded from this schema (D-018).
 * `ownerId` is also excluded — ownership cannot be transferred.
 * All remaining fields are patchable: `name`, `color`, `icon`, `description`,
 * `lifecycleState`.
 *
 * @example
 * ```ts
 * TagUpdateInputSchema.parse({ name: 'New name', color: 'RED' });
 * TagUpdateInputSchema.parse({ description: 'Updated description' });
 * ```
 */
// Zod 4 .partial() keeps .default(); strip them so absent keys = no change (SPEC-217).
export const TagUpdateInputSchema = z
    .object(stripShapeDefaults(TagCreateBaseSchema.shape))
    .partial();

/**
 * Schema for partial tag updates (PATCH).
 * Alias of TagUpdateInputSchema for clarity.
 */
export const TagPatchInputSchema = TagUpdateInputSchema;

/**
 * Schema for tag update response.
 * Returns the complete updated tag object.
 */
export const TagUpdateOutputSchema = TagSchema;

// ============================================================================
// DELETE SCHEMAS
// ============================================================================

/**
 * Schema for tag deletion input.
 *
 * Tags use hard delete with cascade on `r_entity_tag` (D-011).
 * The `force` flag is kept for backward compatibility with bulk operation flows.
 */
export const TagDeleteInputSchema = z.object({
    id: TagIdSchema,
    force: z
        .boolean({
            message: 'zodError.tag.delete.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for tag deletion response.
 * Returns success status and deletion timestamp.
 */
export const TagDeleteOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.delete.success.required'
        })
        .default(true),
    deletedAt: z
        .date({
            message: 'zodError.tag.delete.deletedAt.invalidType'
        })
        .optional()
});

// ============================================================================
// RESTORE SCHEMAS
// ============================================================================

/**
 * Schema for tag restoration input.
 * Requires only the tag ID.
 */
export const TagRestoreInputSchema = z.object({
    id: TagIdSchema
});

/**
 * Schema for tag restoration response.
 * Returns the complete restored tag object.
 */
export const TagRestoreOutputSchema = TagSchema;

// ============================================================================
// MERGE SCHEMAS
// ============================================================================

/**
 * Schema for tag merge input.
 * Requires source tag ID and target tag ID.
 */
export const TagMergeInputSchema = z.object({
    sourceTagId: TagIdSchema,
    targetTagId: TagIdSchema,
    deleteSourceTag: z
        .boolean({
            message: 'zodError.tag.merge.deleteSourceTag.invalidType'
        })
        .optional()
        .default(true)
});

/**
 * Schema for tag merge response.
 * Returns the target tag and merge statistics.
 */
export const TagMergeOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.merge.success.required'
        })
        .default(true),
    targetTag: TagSchema,
    mergeStats: z.object({
        entitiesMoved: z.number().int().min(0),
        accommodationsMoved: z.number().int().min(0),
        destinationsMoved: z.number().int().min(0),
        postsMoved: z.number().int().min(0),
        eventsMoved: z.number().int().min(0),
        usersMoved: z.number().int().min(0)
    })
});

// ============================================================================
// BULK OPERATIONS SCHEMAS
// ============================================================================

/**
 * Schema for bulk tag operations input.
 * Requires array of tag IDs and operation type.
 */
export const TagBulkOperationInputSchema = z.object({
    ids: z
        .array(TagIdSchema, {
            message: 'zodError.tag.bulkOperation.ids.required'
        })
        .min(1, { message: 'zodError.tag.bulkOperation.ids.min' })
        .max(100, { message: 'zodError.tag.bulkOperation.ids.max' }),
    operation: z.enum(['delete', 'restore'], {
        message: 'zodError.tag.bulkOperation.operation.enum'
    }),
    force: z
        .boolean({
            message: 'zodError.tag.bulkOperation.force.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for bulk tag operations response.
 * Returns operation results for each tag.
 */
export const TagBulkOperationOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.bulkOperation.success.required'
        })
        .default(true),
    results: z.array(
        z.object({
            id: TagIdSchema,
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
// CLEANUP SCHEMAS
// ============================================================================

/**
 * Schema for tag cleanup input.
 * Removes unused tags based on criteria.
 */
export const TagCleanupInputSchema = z.object({
    removeUnused: z
        .boolean({
            message: 'zodError.tag.cleanup.removeUnused.invalidType'
        })
        .optional()
        .default(true),
    minUsageCount: z
        .number({
            message: 'zodError.tag.cleanup.minUsageCount.invalidType'
        })
        .int({ message: 'zodError.tag.cleanup.minUsageCount.int' })
        .min(0, { message: 'zodError.tag.cleanup.minUsageCount.min' })
        .optional()
        .default(0),
    olderThanDays: z
        .number({
            message: 'zodError.tag.cleanup.olderThanDays.invalidType'
        })
        .int({ message: 'zodError.tag.cleanup.olderThanDays.int' })
        .min(1, { message: 'zodError.tag.cleanup.olderThanDays.min' })
        .optional(),
    dryRun: z
        .boolean({
            message: 'zodError.tag.cleanup.dryRun.invalidType'
        })
        .optional()
        .default(false)
});

/**
 * Schema for tag cleanup response.
 * Returns cleanup statistics.
 */
export const TagCleanupOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.cleanup.success.required'
        })
        .default(true),
    isDryRun: z.boolean(),
    stats: z.object({
        totalTagsAnalyzed: z.number().int().min(0),
        unusedTagsFound: z.number().int().min(0),
        tagsRemoved: z.number().int().min(0),
        tagsMerged: z.number().int().min(0)
    }),
    removedTags: z
        .array(
            z.object({
                id: TagIdSchema,
                name: z.string(),
                usageCount: z.number().int().min(0)
            })
        )
        .optional()
});

// ============================================================================
// TAG-ENTITY RELATIONSHIP SCHEMAS
// ============================================================================

/**
 * Schema for adding a tag to an entity (polymorphic).
 * Requires tagId, entityId, and entityType.
 */
export const TagAddToEntityInputSchema = z.object({
    tagId: TagIdSchema,
    entityId: z
        .string({
            message: 'zodError.tag.addToEntity.entityId.required'
        })
        .uuid({ message: 'zodError.tag.addToEntity.entityId.uuid' }),
    entityType: z
        .string({
            message: 'zodError.tag.addToEntity.entityType.required'
        })
        .min(1, { message: 'zodError.tag.addToEntity.entityType.min' })
});

/**
 * Schema for adding tag to entity response.
 * Returns success status.
 */
export const TagAddToEntityOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.addToEntity.success.required'
        })
        .default(true)
});

/**
 * Schema for removing a tag from an entity (polymorphic).
 * Requires tagId, entityId, and entityType.
 */
export const TagRemoveFromEntityInputSchema = z.object({
    tagId: TagIdSchema,
    entityId: z
        .string({
            message: 'zodError.tag.removeFromEntity.entityId.required'
        })
        .uuid({ message: 'zodError.tag.removeFromEntity.entityId.uuid' }),
    entityType: z
        .string({
            message: 'zodError.tag.removeFromEntity.entityType.required'
        })
        .min(1, { message: 'zodError.tag.removeFromEntity.entityType.min' })
});

/**
 * Schema for removing tag from entity response.
 * Returns success status.
 */
export const TagRemoveFromEntityOutputSchema = z.object({
    success: z
        .boolean({
            message: 'zodError.tag.removeFromEntity.success.required'
        })
        .default(true)
});

/**
 * Schema for getting all tags for a given entity (polymorphic).
 * Requires entityId and entityType.
 */
export const TagGetForEntityInputSchema = z.object({
    entityId: z
        .string({
            message: 'zodError.tag.getForEntity.entityId.required'
        })
        .uuid({ message: 'zodError.tag.getForEntity.entityId.uuid' }),
    entityType: z
        .string({
            message: 'zodError.tag.getForEntity.entityType.required'
        })
        .min(1, { message: 'zodError.tag.getForEntity.entityType.min' })
});

/**
 * Schema for getting tags for entity response.
 * Returns array of tags.
 */
export const TagGetForEntityOutputSchema = z.object({
    tags: z.array(TagSchema)
});

/**
 * Schema for getting all entities associated with a tag.
 * Requires tagId, optional entityType filter.
 */
export const TagGetEntitiesByTagInputSchema = z.object({
    tagId: TagIdSchema,
    entityType: z
        .string({
            message: 'zodError.tag.getEntitiesByTag.entityType.required'
        })
        .min(1, { message: 'zodError.tag.getEntitiesByTag.entityType.min' })
        .optional()
});

/**
 * Schema for getting entities by tag response.
 * Returns array of entity references.
 */
export const TagGetEntitiesByTagOutputSchema = z.object({
    entities: z.array(
        z.object({
            entityId: z
                .string({
                    message: 'zodError.tag.getEntitiesByTag.entityId.required'
                })
                .uuid({ message: 'zodError.tag.getEntitiesByTag.entityId.uuid' }),
            entityType: z
                .string({
                    message: 'zodError.tag.getEntitiesByTag.entityType.required'
                })
                .min(1, { message: 'zodError.tag.getEntitiesByTag.entityType.min' })
        })
    )
});

/**
 * Schema for getting popular tags input.
 * Requires limit, optional entityType and timeframe filters.
 */
export const TagGetPopularInputSchema = z.object({
    limit: z
        .number({
            message: 'zodError.tag.getPopular.limit.required'
        })
        .int({ message: 'zodError.tag.getPopular.limit.int' })
        .min(1, { message: 'zodError.tag.getPopular.limit.min' })
        .max(100, { message: 'zodError.tag.getPopular.limit.max' }),
    entityType: z
        .string({
            message: 'zodError.tag.getPopular.entityType.required'
        })
        .min(1, { message: 'zodError.tag.getPopular.entityType.min' })
        .optional(),
    timeframe: z
        .string({
            message: 'zodError.tag.getPopular.timeframe.required'
        })
        .min(1, { message: 'zodError.tag.getPopular.timeframe.min' })
        .optional()
});

/**
 * Schema for getting popular tags response.
 * Returns array of tags with usage counts.
 */
export const TagGetPopularOutputSchema = z.object({
    tags: z.array(TagSchema)
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type TagCreateInput = z.infer<typeof TagCreateInputSchema>;
export type TagCreateOutput = z.infer<typeof TagCreateOutputSchema>;
export type TagUpdateInput = z.infer<typeof TagUpdateInputSchema>;
export type TagPatchInput = z.infer<typeof TagPatchInputSchema>;
export type TagUpdateOutput = z.infer<typeof TagUpdateOutputSchema>;
export type TagDeleteInput = z.infer<typeof TagDeleteInputSchema>;
export type TagDeleteOutput = z.infer<typeof TagDeleteOutputSchema>;
export type TagRestoreInput = z.infer<typeof TagRestoreInputSchema>;
export type TagRestoreOutput = z.infer<typeof TagRestoreOutputSchema>;
export type TagMergeInput = z.infer<typeof TagMergeInputSchema>;
export type TagMergeOutput = z.infer<typeof TagMergeOutputSchema>;
export type TagBulkOperationInput = z.infer<typeof TagBulkOperationInputSchema>;
export type TagBulkOperationOutput = z.infer<typeof TagBulkOperationOutputSchema>;
export type TagCleanupInput = z.infer<typeof TagCleanupInputSchema>;
export type TagCleanupOutput = z.infer<typeof TagCleanupOutputSchema>;
export type TagAddToEntityInput = z.infer<typeof TagAddToEntityInputSchema>;
export type TagAddToEntityOutput = z.infer<typeof TagAddToEntityOutputSchema>;
export type TagRemoveFromEntityInput = z.infer<typeof TagRemoveFromEntityInputSchema>;
export type TagRemoveFromEntityOutput = z.infer<typeof TagRemoveFromEntityOutputSchema>;
export type TagGetForEntityInput = z.infer<typeof TagGetForEntityInputSchema>;
export type TagGetForEntityOutput = z.infer<typeof TagGetForEntityOutputSchema>;
export type TagGetEntitiesByTagInput = z.infer<typeof TagGetEntitiesByTagInputSchema>;
export type TagGetEntitiesByTagOutput = z.infer<typeof TagGetEntitiesByTagOutputSchema>;
export type TagGetPopularInput = z.infer<typeof TagGetPopularInputSchema>;
export type TagGetPopularOutput = z.infer<typeof TagGetPopularOutputSchema>;
