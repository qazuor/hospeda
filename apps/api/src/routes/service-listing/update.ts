import { z } from '@hono/zod-openapi';
import { ServiceListingSchema, ServiceListingUpdateHttpInputSchema } from '@repo/schemas';
import { ServiceListingService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update service listing',
    description: 'Updates an existing service listing',
    tags: ['Service Listings'],
    requestParams: { id: z.string().uuid() },
    requestBody: ServiceListingUpdateHttpInputSchema,
    responseSchema: ServiceListingSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof ServiceListingUpdateHttpInputSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
