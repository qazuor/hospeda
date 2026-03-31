/**
 * Admin post sponsor list endpoint
 * Returns all post sponsors with full admin access
 */
import {
    PermissionEnum,
    PostSponsorAdminSchema,
    PostSponsorAdminSearchSchema
} from '@repo/schemas';
import { PostSponsorService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const postSponsorService = new PostSponsorService({ logger: apiLogger });

/**
 * GET /api/v1/admin/post-sponsors
 * List all post sponsors - Admin endpoint
 * Admin permissions allow viewing all post sponsors via service-level checks
 */
export const adminListPostSponsorsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all post sponsors (admin)',
    description: 'Returns a paginated list of all post sponsors with full admin details',
    tags: ['Post Sponsors'],
    requiredPermissions: [PermissionEnum.POST_SPONSOR_VIEW],
    requestQuery: PostSponsorAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PostSponsorAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await postSponsorService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
