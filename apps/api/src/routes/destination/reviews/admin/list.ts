/**
 * Admin destination reviews list endpoint
 * Returns all destination reviews with full admin access
 */
import {
    DestinationReviewAdminSearchSchema,
    DestinationReviewSchema,
    PermissionEnum
} from '@repo/schemas';
import { DestinationReviewService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const destinationReviewService = new DestinationReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/destination-reviews
 * List all destination reviews - Admin endpoint
 */
export const adminListDestinationReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all destination reviews (admin)',
    description: 'Returns a paginated list of all destination reviews with full admin details',
    tags: ['Destinations', 'Reviews'],
    requestQuery: DestinationReviewAdminSearchSchema.shape,
    responseSchema: DestinationReviewSchema,
    requiredPermissions: [PermissionEnum.DESTINATION_REVIEW_VIEW],
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await destinationReviewService.list(actor, { ...query });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
