import { HttpCreatePromotionSchema, PromotionSchema } from '@repo/schemas';
import { PromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const promotionCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create promotion',
    description: 'Creates a new promotion',
    tags: ['Promotions'],
    requestBody: HttpCreatePromotionSchema,
    responseSchema: PromotionSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new PromotionService({ logger: apiLogger });

        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpCreatePromotionSchema>;

        const result = await service.create(actor, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
