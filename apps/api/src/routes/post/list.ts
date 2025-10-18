import { HttpPostSearchSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List posts',
    description: 'Returns a paginated list of posts',
    tags: ['Posts'],
    requestQuery: HttpPostSearchSchema.shape,
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query as Record<string, unknown>);
        const result = await postService.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
