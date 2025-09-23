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
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('asc'),
        q: z.string().optional(),
        search: z.string().optional()
    },
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const queryData = query as {
            page?: number;
            pageSize?: number;
            search?: string;
            q?: string;
        };
        const page = queryData.page ?? 1;
        const pageSize = queryData.pageSize ?? 20;

        const service = new UserService({ logger: apiLogger });
        const result = await service.list(actor, {
            page,
            pageSize
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: {
                page,
                pageSize,
                total: result.data?.total || 0,
                totalPages: Math.ceil((result.data?.total || 0) / pageSize)
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
