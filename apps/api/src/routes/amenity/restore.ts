import { AmenityIdSchema, AmenitySchema } from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const restoreAmenityRoute = createCRUDRoute({
    method: 'post',
    path: '/amenities/{id}/restore',
    summary: 'Restore amenity',
    description: 'Restores a soft-deleted amenity',
    tags: ['Amenities'],
    requestParams: { id: AmenityIdSchema },
    responseSchema: AmenitySchema,
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.restore(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
