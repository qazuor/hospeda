import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createListRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

export const getAccommodationsByAmenityRoute = createListRoute({
    method: 'get',
    path: '/amenities/{amenityId}/accommodations',
    summary: 'Get accommodations by amenity',
    description: 'Returns a list of accommodations that include a specific amenity',
    tags: ['Amenities', 'Accommodations'],
    requestParams: {
        amenityId: z.string().uuid()
    },
    // TODO: Replace with AccommodationListItem schema when available in @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    requestQuery: {
        page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
        limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional()
    },
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.getAccommodationsByAmenity(actor, {
            amenityId: params.amenityId as string
        });
        if (result.error) throw new Error(result.error.message);
        const q = query as { page?: number; limit?: number };
        const page = q.page ?? 1;
        const pageSize = q.limit ?? 10;
        return {
            items: result.data.accommodations,
            pagination: {
                page,
                limit: pageSize,
                total: result.data.accommodations.length,
                totalPages: 1
            }
        };
    }
});
