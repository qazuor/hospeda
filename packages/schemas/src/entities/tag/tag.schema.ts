import { z } from 'zod';
import { TagIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { LifecycleStatusEnumSchema } from '../../enums/lifecycle-state.schema.js';
import { TagColorEnumSchema } from '../../enums/tag-color.schema.js';
import { TagTypeSchema } from '../../enums/tag-type.schema.js';

/**
 * Tag Schema - Main Entity Schema (Completely Flat)
 *
 * Represents the refactored `tags` table per D-018 (SPEC-086).
 *
 * Key changes from pre-refactor schema:
 * - `slug` removed: user-tags do not have public URLs (D-002).
 * - `notes` removed, replaced by `description` (nullable text).
 * - `type` added: discriminates INTERNAL / SYSTEM / USER (D-002).
 * - `ownerId` added: nullable UUID — NULL for INTERNAL+SYSTEM, required for USER (D-018).
 *
 * Service-layer invariants (enforced in TagCreateInputSchema, not here):
 * 1. `type = USER` ⇒ `ownerId NOT NULL`.
 * 2. `type IN (INTERNAL, SYSTEM)` ⇒ `ownerId IS NULL`.
 */
export const TagSchema = z.object({
    // ID field
    id: TagIdSchema,

    // Audit fields
    createdAt: z.coerce.date({
        message: 'zodError.common.createdAt.required'
    }),
    updatedAt: z.coerce.date({
        message: 'zodError.common.updatedAt.required'
    }),
    createdById: UserIdSchema.nullable(),
    updatedById: UserIdSchema.nullable(),
    // Use .nullish() (not .optional()) because Drizzle returns `null` for unset audit columns.
    deletedAt: z.coerce
        .date({
            message: 'zodError.common.deletedAt.required'
        })
        .nullish(),
    deletedById: UserIdSchema.nullish(),

    // Lifecycle fields
    lifecycleState: LifecycleStatusEnumSchema,

    // Tag-specific fields

    /**
     * Tag type tier (D-002): INTERNAL (admin-only), SYSTEM (all authenticated),
     * or USER (private to ownerId).
     */
    type: TagTypeSchema,

    /**
     * Owner of the tag. NULL for INTERNAL and SYSTEM tags; required for USER tags.
     * When the owning user is hard-deleted, this tag is cascade-deleted (D-004).
     */
    ownerId: UserIdSchema.nullable(),

    name: z
        .string({
            message: 'zodError.tag.name.required'
        })
        .min(2, { message: 'zodError.tag.name.min' })
        .max(50, { message: 'zodError.tag.name.max' }),

    color: TagColorEnumSchema,

    icon: z
        .string({
            message: 'zodError.tag.icon.required'
        })
        .min(2, { message: 'zodError.tag.icon.min' })
        .max(100, { message: 'zodError.tag.icon.max' })
        .nullable()
        .optional(),

    /**
     * Optional human-readable description for this tag.
     * Replaces the pre-refactor `notes` field (D-018, D-003).
     * Searches do NOT include description — only name is searched (D-014).
     */
    description: z
        .string({
            message: 'zodError.tag.description.required'
        })
        .nullable()
        .optional()
});

export type Tag = z.infer<typeof TagSchema>;

/**
 * Tag array schema
 */
export const TagsArraySchema = z.array(TagSchema, {
    message: 'zodError.tags.required'
});
export type TagsArray = z.infer<typeof TagsArraySchema>;
