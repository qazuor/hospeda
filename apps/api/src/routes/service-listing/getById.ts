import { z } from '@hono/zod-openapi';
import { ServiceListingSchema } from '@repo/schemas';
import { ServiceListingService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get service listing by ID',
    description: 'Returns a single service listing by ID',
    tags: ['Service Listings'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ServiceListingSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
