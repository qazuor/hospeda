import { CommentIdPathParamsSchema, SuccessSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin hard-delete comment (SPEC-165 §5.4, AC-22).
 *
 * Permanently removes a comment from the database. No hard `requiredPermissions`
 * on the route: the per-entityType MODERATE gate is enforced by the service
 * (`_canHardDelete`).
 */
export const adminHardDeleteCommentRoute = createAdminRoute({
    method: 'delete',
    path: '/{commentId}/hard',
    summary: 'Hard delete comment',
    description:
        'Permanently deletes a comment. Requires the matching entity-type moderate permission (enforced by the service).',
    tags: ['Comments'],
    requestParams: { commentId: CommentIdPathParamsSchema.shape.commentId },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const commentId = params.commentId as string;
        const result = await service.hardDelete(actor, commentId);
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        // BaseCrudService.hardDelete returns { count }; map it to the success shape
        // explicitly rather than relying on schema strip + default.
        return { success: (result.data?.count ?? 0) > 0 };
    }
});
