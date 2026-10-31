/**
 * Public get posts by related destination endpoint
 * Returns posts related to a specific destination
 */
import { DestinationIdSchema, PostPublicSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { createGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/related/destination/:destinationId
 * Get posts by related destination - Public endpoint
 */
export const publicGetPostsByRelatedDestinationRoute = createPublicListRoute({
    method: 'get',
    path: '/related/destination/{destinationId}',
    summary: 'Get posts by related destination',
    description: 'Returns posts related to a specific destination',
    tags: ['Posts'],
    requestParams: { destinationId: DestinationIdSchema },
    responseSchema: PostPublicSchema,
    handler: async (_ctx: Context, params: Record<string, unknown>) => {
        const actor = createGuestActor();
        const { page, pageSize } = extractPaginationParams({});
        const result = await postService.getByRelatedDestination(actor, {
            destinationId: params.destinationId as string
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {}
});
