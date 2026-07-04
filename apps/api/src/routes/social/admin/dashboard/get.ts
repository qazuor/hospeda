/**
 * Admin social dashboard endpoint — SPEC-254 T-037.
 *
 * GET /api/v1/admin/social/dashboard
 * Returns aggregate KPIs, quick-approval queue, recent failures, and
 * Make webhook configuration status for the social publishing pipeline.
 */
import {
    PermissionEnum,
    SocialDashboardQuerySchema,
    SocialDashboardResponseSchema
} from '@repo/schemas';
import { ServiceError, SocialPostService } from '@repo/service-core';
import type { Context } from 'hono';
import { getDecryptedSocialCredential } from '../../../../services/social-credential-vault.service.js';
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
        'a per-platform target breakdown, ' +
        'and whether the Make webhook URL is configured. ' +
        'Optional dateFrom/dateTo query params scope every metric to that range; omitting both preserves the all-time totals.',
    tags: ['Social Dashboard'],
    requiredPermissions: [PermissionEnum.SOCIAL_POST_VIEW],
    requestQuery: SocialDashboardQuerySchema.shape,
    responseSchema: SocialDashboardResponseSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const webhookResult = await getDecryptedSocialCredential({ key: 'make_webhook_url' });
        const makeWebhookConfigured =
            typeof webhookResult.data?.plaintext === 'string' &&
            webhookResult.data.plaintext.trim().length > 0;
        const q = query as { dateFrom?: Date; dateTo?: Date } | undefined;
        const result = await postService.getDashboard({
            actor,
            makeWebhookConfigured,
            dateFrom: q?.dateFrom,
            dateTo: q?.dateTo
        });

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
