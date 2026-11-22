/**
 * GET /api/v1/protected/experiences/mine/stats
 *
 * One aggregate for the owner's experience dashboard (HOS-2414 F3): the owner's
 * listings counted by publication state, plus the traffic total when the plan
 * grants `view_basic_stats`. See `OwnerListingDashboardSchema`.
 *
 * **Scope isolation:** there is no id or owner parameter. Everything is scoped
 * to `actor.id` inside the service, so another owner's listings cannot be
 * counted.
 *
 * **Permission in the service, not on the route:** this is a closed-list
 * READ_OWN route and the unverified-email guard (TEST:1692:7) forbids naming
 * the owner permission here, so `OwnerListingDashboardService` checks it and
 * answers 403 before reading anything.
 *
 * **Not cached:** the payload depends on the actor and on their plan.
 *
 * @module routes/experience/protected/mineStats
 */
import {
    OwnerDashboardWindowSchema,
    OwnerListingDashboardSchema,
    type ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { OwnerListingDashboardService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { readEffectiveKeys } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const dashboardService = new OwnerListingDashboardService({ logger: apiLogger });

/**
 * GET /mine/stats?window=7d|30d
 * Returns the authenticated owner's experience dashboard aggregate.
 */
export const protectedExperienceMineStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/mine/stats',
    emailUnverifiedOperation: 'READ_OWN',
    summary: 'Get my experience dashboard stats (protected)',
    description:
        "Returns the owner's experience listings counted by publication state and, when the plan " +
        'grants view_basic_stats, the traffic total over a rolling window (7d or 30d). ' +
        'Scoped strictly to the caller. A locked or failed traffic read omits traffic.',
    tags: ['Experience'],
    requestQuery: {
        window: OwnerDashboardWindowSchema.default('30d')
    },
    responseSchema: OwnerListingDashboardSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { window } = query as { window: '7d' | '30d' };

        const result = await dashboardService.getForOwner(actor, {
            vertical: 'experience',
            window,
            canViewTraffic: async () => {
                const keys = await readEffectiveKeys({
                    userId: actor.id,
                    vertical: VerticalEnum.EXPERIENCE,
                    keys: ['view_basic_stats']
                });
                return keys.view_basic_stats === true;
            }
        });

        if (result.error) {
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        }
        return result.data;
    },
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
