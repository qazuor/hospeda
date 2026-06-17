/**
 * Admin gastronomy reviews list endpoint.
 * Returns all gastronomy reviews including pending ones.
 */
import { GastronomyReviewSchema, PermissionEnum } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const gastronomyReviewService = new GastronomyReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/gastronomies/reviews
 * List all gastronomy reviews — Admin endpoint.
 *
 * Returns all reviews including PENDING and REJECTED (not filtered to APPROVED
 * like the public list). Requires COMMERCE_MODERATE_REVIEW permission.
 */
export const adminListGastronomyReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all gastronomy reviews (admin)',
    description:
        'Returns a paginated list of all gastronomy reviews with full admin details, including pending and rejected reviews.',
    tags: ['Gastronomy Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    responseSchema: GastronomyReviewSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await gastronomyReviewService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
