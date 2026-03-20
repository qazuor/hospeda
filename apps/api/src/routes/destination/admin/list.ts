/**
 * Admin destination list endpoint
 * Returns all destinations with full admin access
 */
import {
    DestinationAdminSchema,
    DestinationAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const destinationService = new DestinationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destinations
 * List all destinations - Admin endpoint
 * Admin permissions allow viewing all destinations via service-level checks
 */
export const adminListDestinationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all destinations (admin)',
    description: 'Returns a paginated list of all destinations with full admin details',
    tags: ['Destinations'],
    requiredPermissions: [PermissionEnum.DESTINATION_VIEW_ALL],
    requestQuery: DestinationAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: DestinationAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await destinationService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
