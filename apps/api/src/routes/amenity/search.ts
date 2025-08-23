import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

// Query schema mirrors SearchAmenitySchema (filters: name, type; pagination via page/limit)
const searchQuerySchema = {
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    name: z.string().optional(),
    type: z.string().optional()
};

export const searchAmenitiesRoute = createListRoute({
    method: 'get',
    path: '/amenities/search',
    summary: 'Search amenities',
    description: 'Search amenities by filters and pagination',
    tags: ['Amenities'],
    requestQuery: searchQuerySchema,
    // TODO [c3b456f7-332e-4482-9148-c24aa519adb8]: Replace with AmenityListItem schema when available
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as { page?: number; limit?: number; name?: string; type?: string };
        const page = q.page ?? 1;
        const pageSize = q.limit ?? 10;
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.search(actor, {
            // Cast to match SearchAmenityInput shape (filters optional)
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            filters: q.name || q.type ? { name: q.name, type: q.type } : undefined,
            pagination: { page, pageSize }
        });
        if (result.error) throw new Error(result.error.message);
        return {
            items: result.data.items,
            pagination: {
                page,
                limit: pageSize,
                total: result.data.total,
                totalPages: Math.ceil(result.data.total / pageSize)
            }
        };
    }
});
