import { z } from '@hono/zod-openapi';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const softDeleteAmenityRoute = createCRUDRoute({
    method: 'delete',
    path: '/amenities/{id}',
    summary: 'Soft delete amenity',
    description: 'Marks an amenity as deleted',
    tags: ['Amenities'],
    requestParams: { id: z.string().uuid() },
    // Minimal response schema
    responseSchema: z.object({ id: z.string().uuid() }).partial(),
    handler: async (ctx: Context, params) => {
        const actor = getActorFromContext(ctx);
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
