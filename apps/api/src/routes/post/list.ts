import { z } from '@hono/zod-openapi';
import { PostListItemSchema } from '@repo/schemas';
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
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        q: z.string().optional(),
        sortOrder: z.enum(['ASC', 'DESC']).optional()
    },
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, limit } = (query || {}) as { page?: number; limit?: number };
        const result = await postService.list(actor, { page, pageSize: limit });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data?.items || [],
            pagination: {
                page: page ?? 1,
                limit: limit ?? 10,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / (limit ?? 10))
            }
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
