import {
    AccommodationSchema,
    AmenityAccommodationsHttpSchema,
    AmenityIdSchema,
    createPaginatedResponseSchema
} from '@repo/schemas';
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
        amenityId: AmenityIdSchema
    },
    responseSchema: createPaginatedResponseSchema(AccommodationSchema),
    requestQuery: AmenityAccommodationsHttpSchema.shape,
    handler: async (ctx: Context, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const q = query as { page?: number; pageSize?: number };
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;

        const result = await service.getAccommodationsByAmenity(actor, {
            amenityId: params.amenityId as string,
            page,
            pageSize
        });

        if (result.error) throw new Error(result.error.message);

        return {
            items: result.data.accommodations,
            pagination: {
                page,
                pageSize,
                total: result.data.accommodations.length,
                totalPages: 1
            }
        };
    }
});
