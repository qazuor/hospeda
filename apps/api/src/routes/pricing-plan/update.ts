import {
    PricingPlanSchema,
    type PricingPlanUpdateHttp,
    PricingPlanUpdateHttpSchema,
    httpToDomainPricingPlanUpdate
} from '@repo/schemas';
import { PricingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingPlanUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update pricing plan',
    description: 'Updates an existing pricing plan with partial data',
    tags: ['Pricing Plans'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: PricingPlanUpdateHttpSchema,
    responseSchema: PricingPlanSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        // Convert HTTP data to domain input
        const updateInput = httpToDomainPricingPlanUpdate(body as PricingPlanUpdateHttp);

        const service = new PricingPlanService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof PricingPlanUpdateHttpSchema>;
        const result = await service.update(actor, id as string, updateInput);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Pricing plan not found');
        }

        return result.data;
    }
});
