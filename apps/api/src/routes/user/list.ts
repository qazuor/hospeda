/**
 * Example endpoint showing how to use ResponseFactory.createListResponses
 * This demonstrates how to handle paginated responses with proper typing
 */

import { z } from '@hono/zod-openapi';
import { UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const listUsersRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List users',
    description: 'Returns a paginated list of users',
    tags: ['Users'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        search: z.string().optional(),
        sortOrder: z.enum(['ASC', 'DESC']).optional()
    },
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const queryData = query as { page?: number; limit?: number; search?: string };
        const page = queryData.page ?? 1;
        const pageSize = queryData.limit ?? 10;
        const search = queryData.search;

        const service = new UserService({ logger: apiLogger });
        const result = await service.searchForList(actor, {
            pagination: { page, pageSize },
            ...(search && { filters: { q: search } })
        });

        return {
            items: result.items,
            pagination: {
                page,
                limit: pageSize,
                total: result.total,
                totalPages: Math.ceil(result.total / pageSize)
            }
        };
    },
    options: {
        skipAuth: true,
        skipValidation: true,
        cacheTTL: 60,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
