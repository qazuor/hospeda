import { ServiceListingCreateHttpInputSchema, ServiceListingSchema } from '@repo/schemas';
import { ServiceListingService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create service listing',
    description: 'Creates a new service listing',
    tags: ['Service Listings'],
    requestBody: ServiceListingCreateHttpInputSchema,
    responseSchema: ServiceListingSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof ServiceListingCreateHttpInputSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
