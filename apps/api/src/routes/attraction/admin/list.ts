/**
 * Admin attraction list endpoint
 * Returns all attractions with full admin access
 */
import { AttractionAdminSchema, AttractionAdminSearchSchema, PermissionEnum } from '@repo/schemas';
import { AttractionService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const attractionService = new AttractionService({ logger: apiLogger });

/**
 * GET /api/v1/admin/attractions
 * List all attractions - Admin endpoint
 * Admin permissions allow viewing all attractions via service-level checks
 */
export const adminListAttractionsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all attractions (admin)',
    description: 'Returns a paginated list of all attractions with full admin details',
    tags: ['Attractions'],
    requiredPermissions: [PermissionEnum.ATTRACTION_VIEW],
    requestQuery: AttractionAdminSearchSchema.shape,
    responseSchema: AttractionAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await attractionService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
