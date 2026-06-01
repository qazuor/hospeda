import { CommentIdPathParamsSchema, DeleteResultSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin soft-delete comment (SPEC-165 §5.4, AC-21).
 *
 * Soft-deletes any comment (sets `deletedAt`); the `posts.comments` counter is
 * kept in sync inside the service for POST comments. No hard `requiredPermissions`
 * on the route: the per-entityType MODERATE gate is enforced by the service
 * (`_canSoftDelete`).
 */
export const adminDeleteCommentRoute = createAdminRoute({
    method: 'delete',
    path: '/{commentId}',
    summary: 'Soft delete comment',
    description:
        'Soft-deletes a comment. Requires the matching entity-type moderate permission (enforced by the service).',
    tags: ['Comments'],
    requestParams: { commentId: CommentIdPathParamsSchema.shape.commentId },
    responseSchema: DeleteResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const commentId = params.commentId as string;
        const result = await service.softDelete(actor, commentId);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return {
            deleted: (result.data?.count ?? 0) > 0,
            id: commentId
        };
    }
});
