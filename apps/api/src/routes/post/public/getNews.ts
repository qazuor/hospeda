/**
 * Public get news posts endpoint
 * Returns news posts with optional date filters
 */
import { PostListItemSchema, PostNewsHttpSchema, type ServiceErrorCode } from '@repo/schemas';
import { PostService, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

/**
 * GET /api/v1/public/posts/news
 * List news posts - Public endpoint
 */
export const publicGetNewsPostsRoute = createPublicListRoute({
    method: 'get',
    path: '/news',
    summary: 'List news posts',
    description: 'Returns news posts with optional date filters',
    tags: ['Posts'],
    requestQuery: PostNewsHttpSchema.shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { fromDate, toDate } = (query || {}) as {
            fromDate?: string;
            toDate?: string;
        };
        const { page, pageSize } = extractPaginationParams(query || {});
        const result = await postService.getNews(actor, {
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined
        });
        if (result.error)
            throw new ServiceError(result.error.code as ServiceErrorCode, result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 60
    }
});
