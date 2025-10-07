import { AmenityListItemSchema, AmenitySearchHttpSchema } from '@repo/schemas';
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
    description: 'Returns a paginated list of amenities using standardized HTTP schemas',
    tags: ['Amenities'],
    requestQuery: AmenitySearchHttpSchema.shape,
    responseSchema: AmenityListItemSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const q = query as { page?: number; pageSize?: number };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;
        const service = new AmenityService({ logger: apiLogger });
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
    }
});
