import { z } from '@hono/zod-openapi';
import { type HttpAmenitySearch, HttpAmenitySearchSchema } from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

export const searchAmenitiesRoute = createListRoute({
    method: 'get',
    path: '/amenities/search',
    summary: 'Search amenities',
    description: 'Search amenities by filters and pagination',
    tags: ['Amenities'],
    requestQuery: HttpAmenitySearchSchema.shape, // ✅ Using @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const searchParams = query as HttpAmenitySearch;
        const page = searchParams.page ?? 1;
        const pageSize = searchParams.pageSize ?? 20;

        const service = new AmenityService({ logger: apiLogger });
        const result = await service.search(actor, searchParams);

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
