/**
 * Admin list endpoint for provider trade categories (HOS-919).
 */
import {
    HostTradeCategoryAdminSchema,
    HostTradeCategoryAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { HostTradeCategoryService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const categoryService = new HostTradeCategoryService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trade-categories
 * List categories (page + pageSize) - Admin endpoint
 */
export const adminListHostTradeCategoriesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List provider trade categories (admin)',
    description:
        'Returns a paginated list of provider trade categories. Filters: groupId, lifecycleState, search (slug, names and keywords), includeDeleted.',
    tags: ['HostTradeCategories'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_CATEGORY_VIEW],
    requestQuery: HostTradeCategoryAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: HostTradeCategoryAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await categoryService.adminList(actor, query || {});
        if (result.error) throw new ServiceError(result.error.code, result.error.message);

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
