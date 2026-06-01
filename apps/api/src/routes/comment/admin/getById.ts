import { CommentIdPathParamsSchema, EntityCommentAdminItemSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { type AdminCommentRow, mapAuthorName } from './comment-admin.helpers';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin get comment by id (SPEC-165 §5.4).
 *
 * Returns a single comment (POST or EVENT) with its author resolved, or `null`
 * when not found. No hard `requiredPermissions` on the route: the per-entityType
 * VIEW gate is enforced by the service (`_canView`), since the route middleware
 * only supports AND semantics.
 */
export const adminGetCommentByIdRoute = createAdminRoute({
    method: 'get',
    path: '/{commentId}',
    summary: 'Get comment by id',
    description:
        'Returns a single comment (POST or EVENT) with its author resolved, or null when not found. Requires the matching entity-type comment view permission (enforced by the service).',
    tags: ['Comments'],
    requestParams: { commentId: CommentIdPathParamsSchema.shape.commentId },
    responseSchema: EntityCommentAdminItemSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await service.getById(actor, params.commentId as string);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return result.data ? mapAuthorName(result.data as AdminCommentRow) : null;
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 100, windowMs: 60_000 } }
});
