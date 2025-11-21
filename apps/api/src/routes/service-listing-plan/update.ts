import { z } from '@hono/zod-openapi';
import {
    ServiceListingPlanSchema,
    ServiceListingPlanUpdateHttpSchema,
    httpToDomainServiceListingPlanUpdate
} from '@repo/schemas';
import { ServiceListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingPlanUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update service listing plan',
    description: 'Updates an existing service listing plan',
    tags: ['Service Listing Plans'],
    requestParams: { id: z.string().uuid() },
    requestBody: ServiceListingPlanUpdateHttpSchema,
    responseSchema: ServiceListingPlanSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingPlanService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof ServiceListingPlanUpdateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainServiceListingPlanUpdate(validatedBody);

        const result = await service.update(actor, params.id as string, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
