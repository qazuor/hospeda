/**
 * Admin social dashboard endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/dashboard
 * Returns aggregate KPIs, quick-approval queue, recent failures, and
 * Make webhook configuration status for the social publishing pipeline.
 */
import { PermissionEnum, SocialDashboardResponseSchema } from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../../utils/actor';
import { apiLogger } from '../../../../utils/logger';
import { createAdminRoute } from '../../../../utils/route-factory';

const postService = new SocialPostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/social/dashboard
 * Social pipeline dashboard — Admin endpoint.
 */
export const adminGetSocialDashboardRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Social pipeline dashboard (admin)',
    description:
        'Returns aggregate dashboard data for the social publishing pipeline: ' +
        'KPI counters (totalPosts, pendingReview, scheduled, publishedLast30Days, failedActionNeeded), ' +
        'up to 10 posts pending review (oldest first), ' +
        'up to 10 recent failed targets (newest first), ' +
        'and whether the Make webhook URL is configured.',
    tags: ['Social Dashboard'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_VIEW],
    responseSchema: SocialDashboardResponseSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getDashboard({ actor });

        if (result.error) {
            throw new ServiceError(
                result.error.code,
                result.error.message,
                undefined,
                result.error.reason
            );
        }

        return result.data;
    }
});
