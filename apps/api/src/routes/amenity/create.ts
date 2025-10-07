import type { z } from '@hono/zod-openapi';
import {
    type AmenitiesTypeEnum,
    AmenityCreateInputSchema,
    AmenitySchema,
    LifecycleStatusEnum
} from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

// Instantiate service within handler to cooperate with Vitest mocks

export const createAmenityRoute = createCRUDRoute({
    method: 'post',
    path: '/amenities',
    summary: 'Create amenity',
    description: 'Creates a new amenity',
    tags: ['Amenities'],
    requestBody: AmenityCreateInputSchema,
    responseSchema: AmenitySchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const bodyData = body as z.infer<typeof AmenityCreateInputSchema>;
        const input = {
            ...bodyData,
            type: bodyData.type as AmenitiesTypeEnum,
            isBuiltin: bodyData.isBuiltin ?? false,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        };
        const service = new AmenityService({ logger: apiLogger });
        const result = await service.create(actor, input);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
