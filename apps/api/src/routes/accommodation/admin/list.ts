/**
 * Admin accommodation list endpoint
 * Returns all accommodations with full admin access
 */
import {
    AccommodationAdminSchema,
    AccommodationAdminSearchSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodations
 * List all accommodations - Admin endpoint
 * Admin permissions allow viewing all accommodations via service-level checks
 */
export const adminListAccommodationsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all accommodations (admin)',
    description: 'Returns a paginated list of all accommodations with full admin details',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_VIEW_ALL],
    requestQuery: AccommodationAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: AccommodationAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await accommodationService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
