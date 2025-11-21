import {
    type PricingPlanCreateHttp,
    PricingPlanCreateHttpSchema,
    PricingPlanSchema,
    httpToDomainPricingPlanCreate
} from '@repo/schemas';
import { PricingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingPlanCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create pricing plan',
    description: 'Creates a new pricing plan entity',
    tags: ['Pricing Plans'],
    requestBody: PricingPlanCreateHttpSchema,
    responseSchema: PricingPlanSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        // Convert HTTP data to domain input
        const createInput = httpToDomainPricingPlanCreate(body as PricingPlanCreateHttp);

        const service = new PricingPlanService({ logger: apiLogger });
        const result = await service.create(actor, createInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
