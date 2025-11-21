import { z } from '@hono/zod-openapi';
import {
    TouristServiceSchema,
    TouristServiceUpdateHttpSchema,
    httpToDomainTouristServiceUpdate
} from '@repo/schemas';
import { TouristServiceService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const touristServiceUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update tourist service',
    description: 'Updates an existing tourist service',
    tags: ['Tourist Services'],
    requestParams: { id: z.string().uuid() },
    requestBody: TouristServiceUpdateHttpSchema,
    responseSchema: TouristServiceSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new TouristServiceService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof TouristServiceUpdateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainTouristServiceUpdate(validatedBody);

        const result = await service.update(actor, params.id as string, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
