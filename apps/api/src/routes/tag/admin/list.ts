/**
 * Admin tag list endpoint
 * Returns all tags with full admin access
 */
import { PermissionEnum, TagAdminSearchSchema, TagSchema } from '@repo/schemas';
import { ServiceError, TagService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute } from '../../../utils/route-factory.js';

const tagService = new TagService({ logger: apiLogger });

/**
 * GET /api/v1/admin/tags
 * List all tags - Admin endpoint
 * Admin permissions allow viewing all tags via service-level checks
 */
export const adminListTagsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all tags (admin)',
    description: 'Returns a paginated list of all tags with full admin details',
    tags: ['Tags'],
    requiredPermissions: [PermissionEnum.TAG_VIEW],
    requestQuery: TagAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: TagSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await tagService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
