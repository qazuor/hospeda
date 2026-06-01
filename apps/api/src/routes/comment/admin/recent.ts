import {
    EntityCommentRecentListResponseSchema,
    PermissionEnum,
    RecentCommentsQuerySchema
} from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin recent-comments feed (SPEC-165 §5.4, AC-18).
 *
 * Returns a flat, cross-entity list of the most recent comments (POST + EVENT),
 * ordered by `createdAt` DESC and capped at `pageSize` (no deeper pagination).
 * All moderation states are included; soft-deleted comments are excluded.
 *
 * Access: requires BOTH `POST_COMMENT_VIEW` AND `EVENT_COMMENT_VIEW` permissions.
 * `createAdminRoute` enforces this as an AND (every required permission must be
 * granted). The service applies the same check as defense in depth.
 */
export const adminRecentCommentsRoute = createAdminRoute({
    method: 'get',
    path: '/recent',
    summary: 'Recent comments feed',
    description:
        'Returns the most recent comments across POST and EVENT entities, ordered by creation date (newest first) and capped at pageSize. Requires both POST and EVENT comment view permissions.',
    tags: ['Comments'],
    requiredPermissions: [PermissionEnum.POST_COMMENT_VIEW, PermissionEnum.EVENT_COMMENT_VIEW],
    requestQuery: RecentCommentsQuerySchema.shape,
    responseSchema: EntityCommentRecentListResponseSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const result = await service.listRecent(actor, {
            pageSize: query?.pageSize as number | undefined
        });
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return { data: result.data ?? [] };
    },
    options: { cacheTTL: 60, customRateLimit: { requests: 60, windowMs: 60_000 } }
});
