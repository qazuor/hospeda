import { z } from '@hono/zod-openapi';
import { PostSponsorService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const sponsorListRoute = createListRoute({
    method: 'get',
    path: '/sponsors',
    summary: 'List sponsors',
    description: 'Returns a paginated list of sponsors',
    tags: ['Sponsors'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as { page?: number; limit?: number };
        const page = q.page ?? 1;
        const pageSize = q.limit ?? 10;

        const service = new PostSponsorService({ logger: apiLogger });
        const result = await service.searchForList(actor, {
            pagination: { page, pageSize }
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
    }
});
