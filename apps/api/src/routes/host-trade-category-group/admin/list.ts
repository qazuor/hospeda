/**
 * Admin list endpoint for provider trade category groups (HOS-919).
 */
import {
    HostTradeCategoryGroupAdminSchema,
    HostTradeCategoryGroupAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeCategoryGroupService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const groupService = new HostTradeCategoryGroupService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trade-category-groups
 * List category groups (page + pageSize) - Admin endpoint
 */
export const adminListHostTradeCategoryGroupsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List provider trade category groups (admin)',
    description:
        'Returns a paginated list of provider trade category groups. Filters: search, lifecycleState, includeDeleted.',
    tags: ['HostTradeCategoryGroups'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_VIEW],
    // `sort` loses its Zod default here (HOS-2340), see the categories list route.
    requestQuery: {
        ...HostTradeCategoryGroupAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
        sort: HostTradeCategoryGroupAdminSearchSchema.shape.sort.removeDefault().optional()
    },
    responseSchema: HostTradeCategoryGroupAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await groupService.adminList(actor, query || {});
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
