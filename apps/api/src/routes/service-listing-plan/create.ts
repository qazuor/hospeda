import {
    ServiceListingPlanCreateHttpSchema,
    ServiceListingPlanSchema,
    httpToDomainServiceListingPlanCreate
} from '@repo/schemas';
import { ServiceListingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const serviceListingPlanCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create service listing plan',
    description: 'Creates a new service listing plan',
    tags: ['Service Listing Plans'],
    requestBody: ServiceListingPlanCreateHttpSchema,
    responseSchema: ServiceListingPlanSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new ServiceListingPlanService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof ServiceListingPlanCreateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainServiceListingPlanCreate(validatedBody);

        const result = await service.create(actor, domainData);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
