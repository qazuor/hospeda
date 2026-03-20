/**
 * Admin amenity list endpoint
 * Returns all amenities with full admin access
 */
import { AmenityAdminSchema, AmenityAdminSearchSchema, PermissionEnum } from '@repo/schemas';
import { AmenityService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createAdminListRoute } from '../../../utils/route-factory.js';

const amenityService = new AmenityService({ logger: apiLogger });

/**
 * GET /api/v1/admin/amenities
 * List all amenities - Admin endpoint
 * Admin permissions allow viewing all amenities via service-level checks
 */
export const adminListAmenitiesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all amenities (admin)',
    description: 'Returns a paginated list of all amenities with full admin details',
    tags: ['Amenities'],
    requiredPermissions: [PermissionEnum.AMENITY_VIEW],
    requestQuery: AmenityAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: AmenityAdminSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await amenityService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
