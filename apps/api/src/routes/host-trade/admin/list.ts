/**
 * Admin host-trade list endpoint
 * Returns all host-trade entries with full admin access
 */
import { HostTradeAdminSchema, HostTradeAdminSearchSchema, PermissionEnum } from '@repo/schemas';
import { HostTradeService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const hostTradeService = new HostTradeService({ logger: apiLogger });

/**
 * GET /api/v1/admin/host-trades
 * List all host-trade entries — Admin endpoint
 */
export const adminListHostTradesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all host-trade entries (admin)',
    description:
        'Returns a paginated list of all host-trade directory entries with full admin details',
    tags: ['HostTrades'],
    requiredPermissions: [PermissionEnum.HOST_TRADE_VIEW_ALL],
    requestQuery: HostTradeAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: HostTradeAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await hostTradeService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
