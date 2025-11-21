import { PricingTierSchema, PricingTierUpdateHttpSchema } from '@repo/schemas';
import { PricingTierService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const pricingTierUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update pricing tier',
    description: 'Updates an existing pricing tier with partial data',
    tags: ['Pricing Tiers'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: PricingTierUpdateHttpSchema,
    responseSchema: PricingTierSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PricingTierService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof PricingTierUpdateHttpSchema>;
        const result = await service.update(actor, id as string, body);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Pricing tier not found');
        }

        return result.data;
    }
});
