import type { z } from 'zod';
import { EntityCommentSchema } from './entityComment.schema.js';

/**
 * Field-visibility tiers for EntityComment (SPEC-165 §5).
 *
 * These describe which raw entity columns each access tier may see. The
 * public-facing thread DTO (with a derived `authorName` instead of the raw
 * `authorId`) lives in `entityComment.http.schema.ts`; these schemas express
 * column-level visibility, not the response wire shape.
 */

/**
 * PUBLIC ACCESS — EntityComment.
 *
 * Unauthenticated thread reads. Excludes `moderationState` (only APPROVED rows
 * are ever returned publicly, so exposing the field leaks moderation internals)
 * and the raw `authorId` (the public DTO surfaces a display name instead).
 */
export const EntityCommentPublicSchema = EntityCommentSchema.pick({
    id: true,
    entityType: true,
    entityId: true,
    content: true,
    createdAt: true
});
export type EntityCommentPublic = z.infer<typeof EntityCommentPublicSchema>;

/**
 * ADMIN ACCESS — EntityComment.
 *
 * Full entity including moderation state, author, and soft-delete audit fields.
 * Used by the moderation queue, the detail page, and the recent-comments feed.
 */
export const EntityCommentAdminSchema = EntityCommentSchema;
export type EntityCommentAdmin = z.infer<typeof EntityCommentAdminSchema>;
