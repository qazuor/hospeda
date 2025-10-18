import { PostFeaturedHttpSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const featuredPostsRoute = createListRoute({
    method: 'get',
    path: '/posts/featured',
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
        if (result.error) throw new Error(result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
