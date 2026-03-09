/**
 * Public get post stats endpoint
 * Returns statistics about posts
 */
import { PostStatsSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/stats
 * Get post statistics - Public endpoint
 */
export const publicGetPostStatsRoute = createPublicRoute({
    method: 'get',
    path: '/stats',
    summary: 'Get post stats',
    description: 'Retrieves statistics about posts',
    tags: ['Posts'],
    responseSchema: PostStatsSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getStats(actor, {});
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 600 // Cache for 10 minutes
    }
});
