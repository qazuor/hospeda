import { PricingPlanSchema } from '@repo/schemas';
import { PricingPlanService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingPlanGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get pricing plan by ID',
    description: 'Retrieves a single pricing plan by their unique identifier',
    tags: ['Pricing Plans'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: PricingPlanSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PricingPlanService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Pricing plan not found');
        }

        return result.data;
    }
});
