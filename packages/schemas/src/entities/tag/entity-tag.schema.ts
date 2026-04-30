import { z } from 'zod';
import {
    AccommodationIdSchema,
    DestinationIdSchema,
    EventIdSchema,
    PostIdSchema,
    TagIdSchema,
    UserIdSchema
} from '../../common/id.schema.js';
import { EntityTypeEnumSchema } from '../../enums/entity-type.schema.js';

/**
 * EntityTag Schema - Polymorphic relation schema
 *
 * Defines the `r_entity_tag` row per D-018 (SPEC-086).
 *
 * PK: `(tagId, entityId, entityType, assignedById)`.
 *
 * Key invariants:
 * - `assignedById` is ALWAYS required (NOT NULL). Use SYSTEM_USER_ID for
 *   automated or seed assignments (D-005).
 * - Two different users can apply the same tag to the same entity — they get
 *   separate rows distinguished by `assignedById` (D-007).
 */
export const EntityTagSchema = z.object({
    // Tag reference
    tagId: TagIdSchema,

    // Polymorphic entity reference
    entityId: z.union(
        [AccommodationIdSchema, DestinationIdSchema, UserIdSchema, PostIdSchema, EventIdSchema],
        {
            message: 'zodError.entityTag.entityId.required'
        }
    ),

    // Entity type discriminator
    entityType: EntityTypeEnumSchema,

    /**
     * UUID of the user (or SYSTEM_USER_ID) who applied this tag assignment.
     * Always required — never nullable (D-005).
     */
    assignedById: UserIdSchema
});

export type EntityTag = z.infer<typeof EntityTagSchema>;

/**
 * EntityTag array schema
 */
export const EntityTagsArraySchema = z.array(EntityTagSchema, {
    message: 'zodError.entityTags.required'
});
export type EntityTagsArray = z.infer<typeof EntityTagsArraySchema>;
