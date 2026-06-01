/**
 * Public post comments list endpoint (SPEC-165 §5.2).
 *
 * GET /api/v1/public/posts/:postId/comments
 *
 * Returns a paginated list of APPROVED, non-deleted comments for a published
 * post, oldest-first (natural thread order). No `moderationState` is exposed and
 * the author is surfaced as a display name only (`[Usuario eliminado]` when the
 * author account was removed — risk R6). Responds 404 when the post does not
 * exist or is not published (AC-9); a published post with no approved comments
 * yields an empty page, not a 404 (AC-10).
 */
import {
    EntityCommentPublicItemSchema,
    EntityTypeEnum,
    PostIdSchema,
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

export const publicListPostCommentsRoute = createPublicListRoute({
    method: 'get',
    path: '/{postId}/comments',
    summary: 'List post comments',
    description:
        'Returns a paginated list of approved comments for a published post, oldest first.',
    tags: ['Post Comments'],
    requestParams: {
        postId: PostIdSchema
    },
    requestQuery: PublicCommentThreadQuerySchema.shape,
    responseSchema: EntityCommentPublicItemSchema,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const page = Number(query?.page) || 1;
        const pageSize = Number(query?.pageSize) || 20;
        const service = new EntityCommentService({ logger: apiLogger });
        const result = await service.listPublic(actor, {
            entityType: EntityTypeEnum.POST,
            entityId: params.postId as string,
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
