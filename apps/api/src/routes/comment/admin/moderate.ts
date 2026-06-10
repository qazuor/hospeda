import {
    CommentIdPathParamsSchema,
    EntityCommentSchema,
    ModerateCommentBodySchema
} from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin moderate comment (SPEC-165 §5.4, AC-19 / AC-20).
 *
 * Sets a comment's moderation state (APPROVED ↔ REJECTED). For POST comments the
 * `posts.comments` counter is kept in sync inside the service. No hard
 * `requiredPermissions` on the route: the per-entityType MODERATE gate is enforced
 * by `EntityCommentService.moderate` (which resolves POST_/EVENT_COMMENT_MODERATE
 * from the stored entity type).
 *
 * Returns the updated comment entity (without the enriched `authorName`, which is
 * a read-view concern — list/getById/recent supply it).
 */
export const adminModerateCommentRoute = createAdminRoute({
    method: 'patch',
    path: '/{commentId}/moderation',
    summary: 'Moderate comment',
    description:
        'Sets a comment moderation state (APPROVED or REJECTED). Requires the matching entity-type moderate permission (enforced by the service). Keeps the post comment counter in sync for POST comments.',
    tags: ['Comments'],
    requestParams: { commentId: CommentIdPathParamsSchema.shape.commentId },
    requestBody: ModerateCommentBodySchema,
    responseSchema: EntityCommentSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const result = await service.moderate(actor, {
            commentId: params.commentId as string,
            moderationState: body.moderationState as 'APPROVED' | 'REJECTED'
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return result.data;
    },
    options: { customRateLimit: { requests: 20, windowMs: 60_000 } }
});
