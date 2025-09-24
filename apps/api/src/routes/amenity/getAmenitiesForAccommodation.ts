import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

export const getAmenitiesForAccommodationRoute = createListRoute({
    method: 'get',
    path: '/accommodations/{accommodationId}/amenities',
    summary: 'Get amenities for an accommodation',
    description: 'Returns a list of amenities associated to a given accommodation',
    tags: ['Amenities', 'Accommodations'],
    requestParams: {
        accommodationId: z.string().uuid()
    },
    // TODO [72ec6ec2-18e4-4da4-bb4e-8099cbf26087]: Replace with AmenityListItem schema when available in @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        pageSize: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
        q: z.string().optional()
    },
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const q = query as {
            page?: number;
            pageSize?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
            q?: string;
        };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;

        const result = await service.getAmenitiesForAccommodation(actor, {
            accommodationId: params.accommodationId as string,
            page,
            pageSize
        });

        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data.amenities,
            pagination: {
                page,
                pageSize,
                total: result.data.amenities.length,
                totalPages: 1
            }
        };
    }
});
