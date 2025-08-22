import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

export const amenityListRoute = createListRoute({
    method: 'get',
    path: '/amenities',
    summary: 'List amenities',
    description: 'Returns a paginated list of amenities',
    tags: ['Amenities'],
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    // TODO: Replace with AmenityListItem schema when available in @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as { page?: number; limit?: number };
        const page = q.page ?? 1;
        const pageSize = q.limit ?? 10;
        const service = new AmenityService({ logger: apiLogger });
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
