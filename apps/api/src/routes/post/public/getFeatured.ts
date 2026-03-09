/**
 * Public get featured posts endpoint
 * Returns featured posts with pagination
 */
import { PostFeaturedHttpSchema, PostListItemSchema } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/featured
 * Get featured posts - Public endpoint
 */
export const publicGetFeaturedPostsRoute = createPublicListRoute({
    method: 'get',
    path: '/featured',
    summary: 'Get featured posts',
    description: 'Returns featured posts with pagination',
    tags: ['Posts'],
    requestQuery: PostFeaturedHttpSchema.shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { fromDate, toDate } = (query || {}) as {
            fromDate?: string;
            toDate?: string;
        };
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await postService.getFeatured(actor, {
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined
        });
        if (result.error) throw new ServiceError(result.error.code, result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 60
    }
});
