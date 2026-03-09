/**
 * Public get post summary endpoint
 * Returns a summary of a post by its ID
 */
import { PostIdSchema, PostSummarySchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/:id/summary
 * Get post summary - Public endpoint
 */
export const publicGetPostSummaryRoute = createPublicRoute({
    method: 'get',
    path: '/{id}/summary',
    summary: 'Get post summary',
    description: 'Retrieves a summary of a post by its ID',
    tags: ['Posts'],
    requestParams: { id: PostIdSchema },
    responseSchema: PostSummarySchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await postService.getSummary(actor, { id: params.id as string });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return result.data;
    },
    options: {
        cacheTTL: 300
    }
});
