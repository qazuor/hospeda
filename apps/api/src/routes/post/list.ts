import { type HttpPostSearch, HttpPostSearchSchema, PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const postListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List posts',
    description: 'Returns a paginated list of posts',
    tags: ['Posts'],
    requestQuery: HttpPostSearchSchema.shape, // ✅ Using @repo/schemas
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as HttpPostSearch;
        const { page, pageSize } = searchParams;
        const result = await postService.list(actor, { page, pageSize });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: {
                page: page ?? 1,
                pageSize: pageSize ?? 20,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / (pageSize ?? 20))
            }
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
