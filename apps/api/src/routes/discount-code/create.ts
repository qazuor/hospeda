import { DiscountCodeSchema, HttpCreateDiscountCodeSchema } from '@repo/schemas';
import { DiscountCodeService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const discountCodeCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create discount code',
    description: 'Creates a new discount code',
    tags: ['Discount Codes'],
    requestBody: HttpCreateDiscountCodeSchema,
    responseSchema: DiscountCodeSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new DiscountCodeService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpCreateDiscountCodeSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
