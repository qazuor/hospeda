import { z } from '@hono/zod-openapi';
import { PostListItemSchema } from '@repo/schemas';
import { PostService } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

const postService = new PostService({ logger: apiLogger });

export const getFeaturedPostsRoute = createListRoute({
    method: 'get',
    path: '/featured',
    summary: 'List featured posts',
    description: 'Returns featured posts with optional date filters',
    tags: ['Posts'],
    requestQuery: {
        fromDate: z.string().datetime().optional(),
        toDate: z.string().datetime().optional(),
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: PostListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { fromDate, toDate, page, limit } = (query || {}) as {
            fromDate?: string;
            toDate?: string;
            page?: number;
            limit?: number;
        };
        const result = await postService.getFeatured(actor, {
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
            page,
            pageSize: limit
        });
        if (result.error) throw new Error(result.error.message);
        return {
            items: (result.data as never) || [],
            pagination: { page: page ?? 1, limit: limit ?? 10, total: 0, totalPages: 0 }
        };
    },
    options: { skipAuth: true, skipValidation: true, cacheTTL: 60 }
});
