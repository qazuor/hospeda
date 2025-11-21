import { z } from '@hono/zod-openapi';
import { ServiceListingPlanSchema } from '@repo/schemas';
import { ServiceListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingPlanDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete service listing plan',
    description: 'Soft deletes a service listing plan',
    tags: ['Service Listing Plans'],
    requestParams: { id: z.string().uuid() },
    responseSchema: ServiceListingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingPlanService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
