/**
 * Admin experience reviews list endpoint.
 * Returns all experience reviews including pending ones.
 */
import { ExperienceReviewSchema, ModerationStatusEnum, PermissionEnum } from '@repo/schemas';
import { ExperienceReviewService, ServiceError } from '@repo/service-core';
import { z } from 'zod';
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
 * like the public list). Requires EXPERIENCE_MODERATE_REVIEW permission.
 *
 * Same convention as the venue reviews list: the moderation panel sends
 * `status` as the *moderation* state (the shared `usePendingReviewsQuery` hook
 * always sends `status=PENDING`). It is declared in `requestQuery` so the
 * factory whitelists and validates it, then mapped to `moderationState` before
 * `adminList` — the base `status` param means lifecycle state and has no PENDING.
 */
export const adminListExperienceReviewsRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List all experience reviews (admin)',
    description:
        'Returns a paginated list of all experience reviews with full admin details, including pending and rejected reviews.',
    tags: ['Experience Reviews', 'Admin'],
    anyOfPermissions: [[PermissionEnum.EXPERIENCE_MODERATE_REVIEW]],
    requestQuery: {
        status: z.nativeEnum(ModerationStatusEnum).optional()
    },
    responseSchema: ExperienceReviewSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const { status, ...rest } = (query || {}) as Record<string, unknown> & {
            status?: ModerationStatusEnum;
        };
        const result = await experienceReviewService.adminList(actor, {
            ...rest,
            ...(status ? { moderationState: status } : {})
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
