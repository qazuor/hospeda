import type { z } from '@hono/zod-openapi';
import {
    type AmenitiesTypeEnum,
    AmenityIdSchema,
    AmenitySchema,
    AmenityUpdateInputSchema
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const updateAmenityRoute = createCRUDRoute({
    method: 'put',
    path: '/amenities/{id}',
    summary: 'Update amenity',
    description: 'Updates an existing amenity',
    tags: ['Amenities'],
    requestParams: { id: AmenityIdSchema },
    requestBody: AmenityUpdateInputSchema,
    responseSchema: AmenitySchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const bodyData = body as z.infer<typeof AmenityUpdateInputSchema>;
        const input = {
            ...bodyData,
            type: bodyData.type ? (bodyData.type as AmenitiesTypeEnum) : undefined
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.update(actor, params.id as string, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
