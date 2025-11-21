import { z } from '@hono/zod-openapi';
import { HttpUpdatePromotionSchema, PromotionSchema } from '@repo/schemas';
import { PromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const promotionUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update promotion',
    description: 'Updates an existing promotion',
    tags: ['Promotions'],
    requestParams: { id: z.string().uuid() },
    requestBody: HttpUpdatePromotionSchema,
    responseSchema: PromotionSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new PromotionService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpUpdatePromotionSchema>;

        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
