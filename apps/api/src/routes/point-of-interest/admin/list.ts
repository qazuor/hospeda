/**
 * Admin point-of-interest list endpoint
 * Returns all points of interest with full admin access
 */
import {
    PermissionEnum,
    PointOfInterestAdminSchema,
    PointOfInterestAdminSearchSchema
} from '@repo/schemas';
import { PointOfInterestService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

const pointOfInterestService = new PointOfInterestService({ logger: apiLogger });

/**
 * GET /api/v1/admin/points-of-interest
 * List all points of interest - Admin endpoint
 * Admin permissions allow viewing all points of interest via service-level checks
 */
export const adminListPointsOfInterestRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all points of interest (admin)',
    description: 'Returns a paginated list of all points of interest with full admin details',
    tags: ['PointsOfInterest'],
    requiredPermissions: [PermissionEnum.POINT_OF_INTEREST_VIEW],
    requestQuery: PointOfInterestAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: PointOfInterestAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await pointOfInterestService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
