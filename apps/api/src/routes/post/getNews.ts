import { PostListItemSchema, PostNewsHttpSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getNewsPostsRoute = createListRoute({
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
        if (result.error) throw new Error(result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: getPaginationResponse(0, { page, pageSize })
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
