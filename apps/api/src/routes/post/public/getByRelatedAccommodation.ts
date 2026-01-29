/**
 * Public get posts by related accommodation endpoint
 * Returns posts related to a specific accommodation
 */
import { AccommodationIdSchema, PostListItemSchema, type ServiceErrorCode } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/related/accommodation/:accommodationId
 * Get posts by related accommodation - Public endpoint
 */
export const publicGetPostsByRelatedAccommodationRoute = createPublicListRoute({
    method: 'get',
    path: '/related/accommodation/{accommodationId}',
    summary: 'Get posts by related accommodation',
    description: 'Returns posts related to a specific accommodation',
    tags: ['Posts'],
    requestParams: { accommodationId: AccommodationIdSchema },
    responseSchema: PostListItemSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams({});
        const result = await postService.getByRelatedAccommodation(actor, {
            accommodationId: params.accommodationId as string
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
