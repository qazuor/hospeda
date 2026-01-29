/**
 * Public get posts by related event endpoint
 * Returns posts related to a specific event
 */
import { EventIdSchema, PostListItemSchema, type ServiceErrorCode } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/related/event/:eventId
 * Get posts by related event - Public endpoint
 */
export const publicGetPostsByRelatedEventRoute = createPublicListRoute({
    method: 'get',
    path: '/related/event/{eventId}',
    summary: 'Get posts by related event',
    description: 'Returns posts related to a specific event',
    tags: ['Posts'],
    requestParams: { eventId: EventIdSchema },
    responseSchema: PostListItemSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams({});
        const result = await postService.getByRelatedEvent(actor, {
            eventId: params.eventId as string
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300
    }
});
