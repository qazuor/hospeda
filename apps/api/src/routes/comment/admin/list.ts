import { EntityCommentAdminItemSchema, EntityCommentAdminSearchSchema } from '@repo/schemas';
import { EntityCommentService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';
import { type AdminCommentRow, mapAuthorName } from './comment-admin.helpers';

const service = new EntityCommentService({ logger: apiLogger });

/**
 * Admin comment list (SPEC-165 §5.4, AC-17).
 *
 * Paginated, filterable list of comments across POST and EVENT entities.
 * No hard `requiredPermissions` on the route: the OR gate (POST_COMMENT_VIEW
 * OR EVENT_COMMENT_VIEW) is enforced by the service (`_canList`), since the
 * route middleware only supports AND semantics.
 */
export const adminListCommentsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List comments',
    description:
        'Paginated, filterable list of comments across POST and EVENT entities. Requires POST or EVENT comment view permission (enforced by the service).',
    tags: ['Comments'],
    requestQuery: EntityCommentAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: EntityCommentAdminItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await service.adminList(actor, query || {});
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }
        return {
            items: (result.data?.items || []).map((item) => mapAuthorName(item as AdminCommentRow)),
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
