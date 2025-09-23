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
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        q: z.string().optional()
    },
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = (query || {}) as { page?: number; pageSize?: number };
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
