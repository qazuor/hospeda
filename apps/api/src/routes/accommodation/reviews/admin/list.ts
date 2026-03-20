/**
 * Admin accommodation reviews list endpoint
 * Returns all reviews with full admin access
 */
import {
    AccommodationReviewAdminSearchSchema,
    AccommodationReviewSchema,
    PermissionEnum
} from '@repo/schemas';
import { AccommodationReviewService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const accommodationReviewService = new AccommodationReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/accommodation-reviews
 * List all accommodation reviews - Admin endpoint
 */
export const adminListAccommodationReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all accommodation reviews (admin)',
    description: 'Returns a paginated list of all accommodation reviews with full admin details',
    tags: ['Accommodation Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_REVIEW_VIEW],
    requestQuery: AccommodationReviewAdminSearchSchema.omit({ page: true, pageSize: true }).shape,
    responseSchema: AccommodationReviewSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Pass all admin search filters to service
        const result = await accommodationReviewService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
