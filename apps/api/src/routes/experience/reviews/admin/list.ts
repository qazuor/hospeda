/**
 * Admin experience reviews list endpoint.
 * Returns all experience reviews including pending ones.
 */
import { ExperienceReviewSchema, PermissionEnum } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../../utils/pagination';
import { createAdminListRoute } from '../../../../utils/route-factory';

const experienceReviewService = new ExperienceReviewService({ logger: apiLogger });

/**
 * GET /api/v1/admin/experiences/reviews
 * List all experience reviews — Admin endpoint.
 *
 * Returns all reviews including PENDING and REJECTED (not filtered to APPROVED
 * like the public list). Requires COMMERCE_MODERATE_REVIEW permission.
 */
export const adminListExperienceReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all experience reviews (admin)',
    description:
        'Returns a paginated list of all experience reviews with full admin details, including pending and rejected reviews.',
    tags: ['Experience Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    responseSchema: ExperienceReviewSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await experienceReviewService.adminList(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
