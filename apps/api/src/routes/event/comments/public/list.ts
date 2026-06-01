/**
 * Public event comments list endpoint (SPEC-165 §5.2).
 *
 * GET /api/v1/public/events/:eventId/comments
 *
 * Returns a paginated list of APPROVED, non-deleted comments for a published
 * event, oldest-first. No `moderationState` is exposed and the author is
 * surfaced as a display name only (`[Usuario eliminado]` when the author account
 * was removed — risk R6). Responds 404 when the event does not exist or is not
 * published (AC-9); a published event with no approved comments yields an empty
 * page, not a 404 (AC-10 / AC-30).
 */
import {
    EntityCommentPublicItemSchema,
    EntityTypeEnum,
    EventIdSchema,
    PublicCommentThreadQuerySchema
} from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { getPaginationResponse } from '../../../../utils/pagination';
import { createPublicListRoute } from '../../../../utils/route-factory';

/** Display name used when a comment's author account has been deleted (risk R6). */
const DELETED_AUTHOR_NAME = '[Usuario eliminado]';

export const publicListEventCommentsRoute = createPublicListRoute({
    method: 'get',
    path: '/{eventId}/comments',
    summary: 'List event comments',
    description:
        'Returns a paginated list of approved comments for a published event, oldest first.',
    tags: ['Event Comments'],
    requestParams: {
        eventId: EventIdSchema
    },
    requestQuery: PublicCommentThreadQuerySchema.shape,
    responseSchema: EntityCommentPublicItemSchema,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const page = Number(query?.page) || 1;
        const pageSize = Number(query?.pageSize) || 20;
        const service = new EntityCommentService({ logger: apiLogger });
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.EVENT,
            entityId: params.eventId as string,
            page,
            pageSize
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        const items = (result.data.items as Array<Record<string, unknown>>).map((comment) => {
            const author = comment.author as { displayName?: string | null } | null;
            return {
                id: comment.id as string,
                authorName: author?.displayName ?? DELETED_AUTHOR_NAME,
                content: comment.content as string,
                createdAt: comment.createdAt as Date
            };
        });

        return {
            items,
            pagination: getPaginationResponse(result.data.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
