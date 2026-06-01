import { z } from 'zod';
import { EntityCommentIdSchema } from '../../common/id.schema.js';
import { PaginationResultSchema } from '../../common/pagination.schema.js';
import { EntityTypeEnumSchema, ModerationStatusEnumSchema } from '../../enums/index.js';
import { ModerateEntityCommentInputSchema } from './entityComment.crud.schema.js';
import { CommentContentSchema, EntityCommentSchema } from './entityComment.schema.js';

/**
 * EntityComment HTTP wire schemas (SPEC-165 §5).
 *
 * These are the request/response shapes exchanged over HTTP, distinct from the
 * stored-entity schema. The public DTO deliberately replaces the raw `authorId`
 * with a derived `authorName` and omits `moderationState`.
 */

// ============================================================================
// PATH PARAMS
// ============================================================================

/** `:postId` for the post comment routes. */
export const PostCommentsPathParamsSchema = z.object({
    postId: z.string().uuid({ message: 'zodError.entityComment.postId.invalidUuid' })
});

/** `:eventId` for the event comment routes. */
export const EventCommentsPathParamsSchema = z.object({
    eventId: z.string().uuid({ message: 'zodError.entityComment.eventId.invalidUuid' })
});

/** `:commentId` for the protected delete and all admin comment routes. */
export const CommentIdPathParamsSchema = z.object({
    commentId: EntityCommentIdSchema
});

// ============================================================================
// REQUEST BODIES
// ============================================================================

/**
 * Create body for `POST /posts/:postId/comments` and `POST /events/:eventId/comments`.
 * Only the content is supplied by the client; `entityType`/`entityId` come from the
 * path and `authorId` from the session (SPEC-165 §5.3).
 */
export const CreateCommentBodySchema = z
    .object({
        content: CommentContentSchema
    })
    .strict();
export type CreateCommentBody = z.infer<typeof CreateCommentBodySchema>;

/** Moderation PATCH body. Re-exported from the CRUD module for route co-location. */
export const ModerateCommentBodySchema = ModerateEntityCommentInputSchema;
export type ModerateCommentBody = z.infer<typeof ModerateCommentBodySchema>;

// ============================================================================
// RESPONSE ITEMS
// ============================================================================

/**
 * Public thread item — `GET /public/{posts|events}/:id/comments` (SPEC-165 §5.2,
 * AC-8). No `moderationState`, no raw `authorId`. `authorName` is the author's
 * display name, or "[Usuario eliminado]" when the author account was deleted.
 */
export const EntityCommentPublicItemSchema = z.object({
    id: EntityCommentIdSchema,
    authorName: z.string(),
    content: CommentContentSchema,
    createdAt: z.coerce.date()
});
export type EntityCommentPublicItem = z.infer<typeof EntityCommentPublicItemSchema>;

/** Paginated public thread response. */
export const EntityCommentPublicListResponseSchema = PaginationResultSchema(
    EntityCommentPublicItemSchema
);
export type EntityCommentPublicListResponse = z.infer<typeof EntityCommentPublicListResponseSchema>;

/**
 * Admin list/detail item — the full stored comment plus the resolved
 * `authorName`. Used by `GET /admin/comments`, `GET /admin/comments/:id`, and the
 * moderation/restore responses.
 */
export const EntityCommentAdminItemSchema = EntityCommentSchema.extend({
    authorName: z.string()
});
export type EntityCommentAdminItem = z.infer<typeof EntityCommentAdminItemSchema>;

/** Paginated admin list response. */
export const EntityCommentAdminListResponseSchema = PaginationResultSchema(
    EntityCommentAdminItemSchema
);
export type EntityCommentAdminListResponse = z.infer<typeof EntityCommentAdminListResponseSchema>;

/**
 * Recent-feed item — `GET /admin/comments/recent` (SPEC-155 EDITOR card H,
 * SPEC-165 §5.4, AC-17). Fixed field set across both POST and EVENT entities.
 */
export const EntityCommentRecentItemSchema = z.object({
    id: EntityCommentIdSchema,
    entityType: EntityTypeEnumSchema,
    entityId: z.string().uuid(),
    content: CommentContentSchema,
    authorName: z.string(),
    moderationState: ModerationStatusEnumSchema,
    createdAt: z.coerce.date()
});
export type EntityCommentRecentItem = z.infer<typeof EntityCommentRecentItemSchema>;

/** Recent-feed response — a flat list capped at `pageSize` (no deeper pagination). */
export const EntityCommentRecentListResponseSchema = z.object({
    data: z.array(EntityCommentRecentItemSchema)
});
export type EntityCommentRecentListResponse = z.infer<typeof EntityCommentRecentListResponseSchema>;
