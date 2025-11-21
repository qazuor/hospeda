import { z } from '@hono/zod-openapi';
import { ServiceListingPlanSchema } from '@repo/schemas';
import { ServiceListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingPlanGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get service listing plan by ID',
    description: 'Returns a single service listing plan by ID',
    tags: ['Service Listing Plans'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ServiceListingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingPlanService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
