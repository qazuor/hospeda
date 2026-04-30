import { z } from 'zod';
import { TagIdSchema, UserIdSchema } from '../../common/id.schema.js';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';
import { TagSchema } from './tag.schema.js';

/**
 * PUBLIC ACCESS SCHEMA
 *
 * Contains only the minimum data safe to expose to unauthenticated users.
 * Used for public tag display (filters, badges, labels).
 *
 * Picks specific fields from the full schema to ensure only public data is exposed.
 */
export const TagPublicSchema = TagSchema.pick({
    // Identification
    id: true,
    name: true,

    // Display properties
    color: true,
    icon: true
});

export type TagPublic = z.infer<typeof TagPublicSchema>;

/**
 * PROTECTED ACCESS SCHEMA
 *
 * Contains data for authenticated users, including lifecycle and notes.
 * Used for authenticated tag management and contributor views.
 *
 * Extends public fields with lifecycle and audit data.
 */
export const TagProtectedSchema = TagSchema.pick({
    // All public fields
    id: true,
    name: true,
    color: true,
    icon: true,

    // Lifecycle
    lifecycleState: true,

    // Additional metadata
    description: true,

    // Audit (basic timestamps)
    createdAt: true,
    updatedAt: true
});

export type TagProtected = z.infer<typeof TagProtectedSchema>;

/**
 * ADMIN ACCESS SCHEMA
 *
 * Contains ALL fields including sensitive admin-only data.
 * Used for admin dashboard, moderation, and management.
 *
 * This is essentially the full schema.
 */
export const TagAdminSchema = TagSchema;

export type TagAdmin = z.infer<typeof TagAdminSchema>;

// ============================================================================
// PICKER VISIBILITY ENUM
// ============================================================================

/**
 * Discriminates which tier of tags the picker shows to a given actor.
 *
 * Maps directly to the D-006 visibility matrix from SPEC-086:
 * - `ANONYMOUS`: No picker; anonymous users never see user-tags.
 * - `AUTHENTICATED`: `SYSTEM` tags + actor's own `USER` tags.
 * - `ADMIN_WITH_INTERNAL_VIEW`: `INTERNAL` + `SYSTEM` + own `USER` tags
 *   (requires `TAG_INTERNAL_VIEW` permission).
 * - `SUPER_ADMIN_MODERATION`: All tags across all users (separate moderation
 *   UI, not the standard picker; requires `TAG_VIEW_ALL_USER_TAGS`).
 *
 * @example
 * ```ts
 * TagPickerVisibilitySchema.parse('AUTHENTICATED') // => 'AUTHENTICATED'
 * TagPickerVisibilitySchema.parse('INVALID')        // throws ZodError
 * ```
 */
export const TagPickerVisibilitySchema = z.enum(
    ['ANONYMOUS', 'AUTHENTICATED', 'ADMIN_WITH_INTERNAL_VIEW', 'SUPER_ADMIN_MODERATION'],
    {
        error: () => ({ message: 'zodError.tag.pickerVisibility.invalid' })
    }
);

export type TagPickerVisibility = z.infer<typeof TagPickerVisibilitySchema>;

// ============================================================================
// PICKER QUERY CONTEXT
// ============================================================================

/**
 * Input context passed to the service layer when resolving which tags to
 * surface in the tag picker for a given actor.
 *
 * The service uses these two fields to determine the actor's
 * {@link TagPickerVisibility} tier (D-006 from SPEC-086):
 * - If `actorId` is not present in the session, the caller must not invoke the
 *   picker at all (anonymous actors have no picker).
 * - `hasTagInternalView` is derived from the actor's permissions
 *   (`TAG_INTERNAL_VIEW`). When `true`, INTERNAL tags are included in the
 *   picker results.
 *
 * @example
 * ```ts
 * PickerQueryContextSchema.parse({
 *   actorId: '550e8400-e29b-41d4-a716-446655440000',
 *   hasTagInternalView: false,
 * })
 * ```
 */
export const PickerQueryContextSchema = z.object({
    /**
     * UUID of the authenticated actor making the picker query.
     * Must be a valid UUID.
     */
    actorId: z
        .string({
            message: 'zodError.tag.pickerQueryContext.actorId.required'
        })
        .uuid({ message: 'zodError.tag.pickerQueryContext.actorId.uuid' }),

    /**
     * Whether the actor holds the `TAG_INTERNAL_VIEW` permission.
     * When `true`, INTERNAL tags are included in the picker.
     */
    hasTagInternalView: z.boolean({
        message: 'zodError.tag.pickerQueryContext.hasTagInternalView.required'
    })
});

export type PickerQueryContext = z.infer<typeof PickerQueryContextSchema>;

// ============================================================================
// TAG ASSIGN / REMOVE INPUT SCHEMAS
// ============================================================================

/**
 * Input schema for assigning a user-tag to an entity.
 *
 * Represents a single row insert into `r_entity_tag`. All four fields are
 * required — there is no optional attribution.
 *
 * Before any insert the service validates (D-008, D-009 from SPEC-086):
 * 1. The tag exists.
 * 2. The actor's picker visibility includes the tag.
 * 3. The actor has read access to the target entity.
 *
 * When the assignment comes from an automated source (seed, cron, webhook),
 * `assignedById` MUST be the reserved `SYSTEM_USER_ID` constant (D-005).
 *
 * @example
 * ```ts
 * TagAssignInputSchema.parse({
 *   tagId: '550e8400-e29b-41d4-a716-446655440000',
 *   entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   entityType: 'ACCOMMODATION',
 *   assignedById: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
 * })
 * ```
 */
export const TagAssignInputSchema = z.object({
    /**
     * UUID of the tag being assigned. Must reference an existing tag row.
     */
    tagId: TagIdSchema,

    /**
     * UUID of the entity receiving the tag assignment.
     */
    entityId: z
        .string({
            message: 'zodError.tag.assign.entityId.required'
        })
        .uuid({ message: 'zodError.tag.assign.entityId.uuid' }),

    /**
     * Discriminator that identifies the entity table for the polymorphic FK.
     */
    entityType: EntityTypeEnumSchema,

    /**
     * UUID of the actor performing the assignment, or SYSTEM_USER_ID for
     * automated assignments. Never nullable — D-005 from SPEC-086.
     */
    assignedById: UserIdSchema
});

export type TagAssignInput = z.infer<typeof TagAssignInputSchema>;

/**
 * Input schema for removing a user-tag assignment from an entity.
 *
 * Matches the four-column composite PK on `r_entity_tag`:
 * `(tagId, entityId, entityType, assignedById)`.
 *
 * All four fields are required to uniquely identify the row to delete.
 *
 * @example
 * ```ts
 * TagAssignRemoveInputSchema.parse({
 *   tagId: '550e8400-e29b-41d4-a716-446655440000',
 *   entityId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
 *   entityType: 'POST',
 *   assignedById: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
 * })
 * ```
 */
export const TagAssignRemoveInputSchema = z.object({
    /**
     * UUID of the tag being removed.
     */
    tagId: TagIdSchema,

    /**
     * UUID of the entity from which the tag is removed.
     */
    entityId: z
        .string({
            message: 'zodError.tag.assignRemove.entityId.required'
        })
        .uuid({ message: 'zodError.tag.assignRemove.entityId.uuid' }),

    /**
     * Entity type discriminator — part of the composite PK.
     */
    entityType: EntityTypeEnumSchema,

    /**
     * UUID of the actor who originally applied the assignment, or
     * SYSTEM_USER_ID for automated assignments.
     */
    assignedById: UserIdSchema
});

export type TagAssignRemoveInput = z.infer<typeof TagAssignRemoveInputSchema>;

// ============================================================================
// IMPACT COUNT RESPONSE SCHEMA
// ============================================================================

/**
 * Response schema returned by tag and PostTag impact endpoints.
 *
 * Used by delete-confirmation flows to show the user how many related rows
 * will be cascade-deleted before proceeding (D-011 from SPEC-086).
 *
 * Routes:
 * - `GET /api/v1/admin/tags/:id/impact`
 * - `GET /api/v1/admin/posts/tags/:id/impact`
 *
 * @example
 * ```ts
 * ImpactCountResponseSchema.parse({ count: 42 }) // => { count: 42 }
 * ImpactCountResponseSchema.parse({ count: -1 }) // throws ZodError
 * ```
 */
export const ImpactCountResponseSchema = z.object({
    /**
     * Number of `r_entity_tag` rows (user-tag) or `r_post_post_tag` rows
     * (PostTag) that reference this tag. Always a non-negative integer.
     */
    count: z
        .number({
            message: 'zodError.tag.impactCount.count.required'
        })
        .int({ message: 'zodError.tag.impactCount.count.int' })
        .nonnegative({ message: 'zodError.tag.impactCount.count.nonnegative' })
});

export type ImpactCountResponse = z.infer<typeof ImpactCountResponseSchema>;
