/**
 * Protected delete-own-comment endpoint (SPEC-165 §5.3).
 *
 * DELETE /api/v1/protected/comments/:commentId
 *
 * Requires a session. The gate is OWNERSHIP, not a permission: the service
 * (`softDeleteOwn`) verifies the actor authored the comment and returns 403
 * otherwise (AC-16), 404 if the comment is missing or already deleted, and
 * decrements `posts.comments` when an APPROVED post comment is removed (AC-15).
 *
 * NOTE: the repo convention for soft-delete is a `SuccessSchema` (HTTP 200)
 * response rather than a bare 204; this follows `post/protected/softDelete.ts`.
 */
import { CommentIdPathParamsSchema, SuccessSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

export const protectedDeleteOwnCommentRoute = createProtectedRoute({
    method: 'delete',
    path: '/{commentId}',
    summary: 'Delete own comment',
    description: 'Soft-deletes the caller’s own comment. Only the author may delete it.',
    tags: ['Comments'],
    requiredPermissions: [],
    requestParams: {
        commentId: CommentIdPathParamsSchema.shape.commentId
    },
    responseSchema: SuccessSchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new EntityCommentService({ logger: apiLogger });
        const result = await service.softDeleteOwn(actor, {
            commentId: params.commentId as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return { success: true };
    }
});
