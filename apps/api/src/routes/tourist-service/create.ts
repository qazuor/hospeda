import {
    TouristServiceCreateHttpSchema,
    TouristServiceSchema,
    httpToDomainTouristServiceCreate
} from '@repo/schemas';
import { TouristServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const touristServiceCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create tourist service',
    description: 'Creates a new tourist service',
    tags: ['Tourist Services'],
    requestBody: TouristServiceCreateHttpSchema,
    responseSchema: TouristServiceSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new TouristServiceService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof TouristServiceCreateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainTouristServiceCreate(validatedBody);

        const result = await service.create(actor, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
