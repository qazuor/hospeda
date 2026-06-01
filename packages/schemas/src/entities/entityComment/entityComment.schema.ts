import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { EntityCommentIdSchema } from '../../common/id.schema.js';
import { EntityTypeEnumSchema, ModerationStatusEnumSchema } from '../../enums/index.js';

/**
 * Maximum length of a comment body, enforced at the Zod layer (the DB column is
 * unconstrained `text`). SPEC-165 §4.1 / AC-13.
 */
export const COMMENT_CONTENT_MIN_LENGTH = 1;
export const COMMENT_CONTENT_MAX_LENGTH = 2000;

/**
 * Reusable content field for a comment body (1–2000 chars, trimmed-length checked
 * by Zod). Shared between the base schema and the create input.
 */
export const CommentContentSchema = z
    .string({ message: 'zodError.entityComment.content.required' })
    .min(COMMENT_CONTENT_MIN_LENGTH, { message: 'zodError.entityComment.content.min' })
    .max(COMMENT_CONTENT_MAX_LENGTH, { message: 'zodError.entityComment.content.max' });

/**
 * EntityComment schema — the stored polymorphic comment entity (SPEC-165).
 *
 * A single table backs comments on posts and events via the `(entityType, entityId)`
 * polymorphic pair. The column accepts the full `EntityTypeEnum`, but the service
 * restricts writes to `POST | EVENT` (RD-3).
 *
 * `authorId` is nullable: the FK is `ON DELETE SET NULL`, so a deleted author's
 * comments are preserved with a null author (surfaced as "[Usuario eliminado]" in
 * the public DTO). The service guarantees a non-null author on create (RD-5 —
 * registered users only).
 */
export const EntityCommentSchema = z.object({
    // Base fields
    id: EntityCommentIdSchema,
    ...BaseAuditFields,

    // Polymorphic target
    entityType: EntityTypeEnumSchema,
    entityId: z
        .string({ message: 'zodError.entityComment.entityId.required' })
        .uuid({ message: 'zodError.entityComment.entityId.invalidUuid' }),

    // Author (nullable: SET NULL on user deletion; always set on create)
    authorId: z
        .string({ message: 'zodError.entityComment.authorId.required' })
        .uuid({ message: 'zodError.entityComment.authorId.invalidUuid' })
        .nullable(),

    // Content
    content: CommentContentSchema,

    // Moderation
    moderationState: ModerationStatusEnumSchema
});

/**
 * Type for EntityComment, inferred from {@link EntityCommentSchema}.
 */
export type EntityComment = z.infer<typeof EntityCommentSchema>;
