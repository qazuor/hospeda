import { PricingTierSchema } from '@repo/schemas';
import { PricingTierService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingTierGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get pricing tier by ID',
    description: 'Retrieves a single pricing tier by their unique identifier',
    tags: ['Pricing Tiers'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: PricingTierSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PricingTierService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Pricing tier not found');
        }

        return result.data;
    }
});
