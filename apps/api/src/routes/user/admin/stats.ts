/**
 * Admin user stats endpoint — SPEC-155 T-012 (pilot aggregation route).
 *
 * Returns two pre-aggregated datasets useful for the admin dashboard:
 *   - `byRole`: count of active (non-deleted) users grouped by role.
 *   - `newUsersTrend`: monthly new-user counts for the last 12 months.
 *
 * This is the PILOT route that establishes the pattern for all sibling
 * aggregation routes in the SPEC-155 admin dashboards milestone.
 */
import { PermissionEnum, UserAdminStatsSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const userService = new UserService({ logger: apiLogger });

/**
 * GET /api/v1/admin/users/stats
 * Aggregated user statistics for the admin dashboard.
 *
 * Returns a fixed-shape JSON object (not paginated), gated on USER_READ_ALL.
 * The endpoint is intentionally cheap to call — both aggregations run as a
 * single round-trip via Promise.all inside the model layer.
 */
export const adminUserStatsRoute = createAdminRoute({
    method: 'get',
    path: '/stats',
    summary: 'Get user statistics (admin)',
    description:
        'Returns users grouped by role and a 12-month new-user trend, ' +
        'intended for the admin dashboard. Requires USER_READ_ALL permission.',
    tags: ['Users'],
    requiredPermissions: [PermissionEnum.USER_READ_ALL],
    responseSchema: UserAdminStatsSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await userService.getAdminStats(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return result.data;
    },
    options: {
        cacheTTL: 60,
        customRateLimit: { requests: 60, windowMs: 60_000 }
    }
});
