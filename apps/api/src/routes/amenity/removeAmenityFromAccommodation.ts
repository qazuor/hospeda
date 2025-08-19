import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const removeAmenityFromAccommodationRoute = createCRUDRoute({
    method: 'delete',
    path: '/accommodations/{accommodationId}/amenities/{amenityId}',
    summary: 'Remove amenity from accommodation',
    description: 'Removes a relation between an amenity and an accommodation',
    tags: ['Amenities', 'Accommodations'],
    requestParams: {
        accommodationId: z.string().uuid(),
        amenityId: z.string().uuid()
    },
    // TODO: Replace with a proper relation schema when available
    responseSchema: z.object({ relation: z.object({ amenityId: z.string().uuid() }).partial() }),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const payload = {
            accommodationId: params.accommodationId as string,
            amenityId: params.amenityId as string
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.removeAmenityFromAccommodation(actor, payload);
        if (result.error) throw new Error(result.error.message);
        return { relation: result.data.relation };
    }
});
