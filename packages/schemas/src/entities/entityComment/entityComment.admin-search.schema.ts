/**
 * Admin Search Schema for EntityComment (SPEC-165 §5.4).
 *
 * Extends the base admin search with comment-specific filters. The base brings
 * `page`, `pageSize`, `search`, `sort`, `status` (lifecycle — unused by comments,
 * harmless), `includeDeleted`, and the created-date range.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { EntityTypeEnumSchema, ModerationStatusEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for the comment moderation list (`GET /admin/comments`).
 *
 * @example
 * ```ts
 * const params = EntityCommentAdminSearchSchema.parse({
 *   page: 1,
 *   entityType: 'POST',
 *   moderationState: 'REJECTED',
 *   includeDeleted: true
 * });
 * ```
 */
export const EntityCommentAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by entity type (POST | EVENT). Omit for both. */
    entityType: EntityTypeEnumSchema.optional().describe('Filter by entity type (POST | EVENT)'),

    /** Filter by moderation state. */
    moderationState: ModerationStatusEnumSchema.optional().describe('Filter by moderation state'),

    /** Filter by the commented entity UUID. */
    entityId: z
        .string()
        .uuid({ message: 'zodError.admin.search.entityComment.entityId.uuid' })
        .optional()
        .describe('Filter by the commented entity (post or event) UUID'),

    /** Filter by author UUID. */
    authorId: z
        .string()
        .uuid({ message: 'zodError.admin.search.entityComment.authorId.uuid' })
        .optional()
        .describe('Filter by author UUID')
});

/**
 * Type inferred from {@link EntityCommentAdminSearchSchema}.
 */
export type EntityCommentAdminSearch = z.infer<typeof EntityCommentAdminSearchSchema>;
