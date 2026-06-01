import { CommentIdPathParamsSchema, RestoreResultSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin restore comment (SPEC-165 §5.4, AC-23).
 *
 * Clears `deletedAt` on a soft-deleted comment; the `posts.comments` counter is
 * kept in sync inside the service for POST comments. No hard `requiredPermissions`
 * on the route: the per-entityType MODERATE gate is enforced by the service
 * (`_canRestore`).
 *
 * `BaseCrudService.restore` returns `{ count }` (not the entity), so the response
 * is the generic restore result (`{ success }`), mirroring the hard-delete route.
 */
export const adminRestoreCommentRoute = createAdminRoute({
    method: 'post',
    path: '/{commentId}/restore',
    summary: 'Restore comment',
    description:
        'Restores a soft-deleted comment. Requires the matching entity-type moderate permission (enforced by the service).',
    tags: ['Comments'],
    requestParams: { commentId: CommentIdPathParamsSchema.shape.commentId },
    responseSchema: RestoreResultSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const commentId = params.commentId as string;
        const result = await service.restore(actor, commentId);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        // BaseCrudService.restore returns { count }; map it to the success shape
        // explicitly rather than relying on schema strip + default.
        return { success: (result.data?.count ?? 0) > 0 };
    }
});
