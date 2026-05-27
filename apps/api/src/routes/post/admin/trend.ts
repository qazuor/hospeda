/**
 * Admin post monthly trend endpoint — SPEC-155 T-008.
 *
 * Returns a 12-month zero-filled series of posts-per-month counts,
 * derived from `posts.created_at`, for the admin dashboard.
 *
 * This route follows the same pattern established by the pilot
 * `GET /api/v1/admin/users/stats` (T-012). The trend half of that
 * pilot is extracted here as a standalone endpoint for the posts entity.
 */
import { PermissionEnum, PostMonthlyTrendSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/admin/posts/trend
 * 12-month posts-per-month trend for the admin dashboard.
 *
 * Returns a fixed-length array of 12 `{ month: YYYY-MM, count: number }`
 * items ordered oldest-first. Months with no published posts are zero-filled.
 * Gated on POST_VIEW_ALL permission.
 */
export const adminPostTrendRoute = createAdminRoute({
    method: 'get',
    path: '/trend',
    summary: 'Get monthly post creation trend (admin)',
    description:
        'Returns posts grouped by month for the last 12 calendar months, ' +
        'zero-filled so the array always has 12 elements (oldest first). ' +
        'Intended for the admin dashboard. Requires POST_VIEW_ALL permission.',
    tags: ['Posts'],
    requiredPermissions: [PermissionEnum.POST_VIEW_ALL],
    responseSchema: PostMonthlyTrendSchema,
    handler: async (ctx) => {
        const actor = getActorFromContext(ctx);

        const result = await postService.getMonthlyTrend(actor);

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
