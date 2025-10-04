import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service inside handler for test mocks

export const amenityGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/amenities/{id}',
    summary: 'Get amenity by ID',
    description: 'Retrieves an amenity by ID',
    tags: ['Amenities'],
    requestParams: {
        id: z.string().uuid()
    },
    // TODO [e2740aba-8404-4a79-99e4-b32fe5cce1e3]: Replace with AmenityDetail schema when available in @repo/schemas
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
