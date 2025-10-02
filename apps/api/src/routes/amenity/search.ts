import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

// Query schema using standardized BaseSearchSchema pattern
const searchQuerySchema = {
    page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
    pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    q: z.string().optional()
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
        const q = query as {
            page?: number;
            pageSize?: number;
            name?: string;
            type?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            q?: string;
        };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;
        const service = new AmenityService({ logger: apiLogger });

        // Standardized service call interface
        const result = await service.search(actor, {
            page,
            pageSize,
            ...(q.name ? { name: q.name } : {}),
            sortBy: q.sortBy,
            sortOrder: q.sortOrder || 'asc',
            q: q.q
        });

        if (result.error) throw new Error(result.error.message);

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
