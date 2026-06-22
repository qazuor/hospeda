/**
 * Admin gastronomy reviews list endpoint.
 * Returns all gastronomy reviews including pending ones.
 */
import { GastronomyReviewSchema, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { GastronomyReviewService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
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
 *
 * The moderation UI sends `status` as the *moderation* state (e.g. PENDING).
 * It is declared in `requestQuery` so the admin-list factory (a) whitelists it
 * — otherwise it is rejected as an unknown param with INVALID_PAGINATION_PARAMS
 * — and (b) validates and forwards it to the handler. It is then mapped to a
 * `moderationState` filter via the dedicated `listForModeration` service
 * method, NOT the base `adminList` `status` param (which means `lifecycleState`).
 */
export const adminListGastronomyReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all gastronomy reviews (admin)',
    description:
        'Returns a paginated list of all gastronomy reviews with full admin details, including pending and rejected reviews.',
    tags: ['Gastronomy Reviews', 'Admin'],
    requiredPermissions: [PermissionEnum.COMMERCE_MODERATE_REVIEW],
    requestQuery: {
        status: z.nativeEnum(ModerationStatusEnum).optional()
    },
    responseSchema: GastronomyReviewSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});
        const moderationState = (query as { status?: ModerationStatusEnum } | undefined)?.status;

        const result = await gastronomyReviewService.listForModeration(actor, {
            moderationState,
            page,
            pageSize
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
