import { z } from '@hono/zod-openapi';
import { PromotionSchema } from '@repo/schemas';
import { PromotionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const promotionDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete promotion',
    description: 'Soft deletes a promotion',
    tags: ['Promotions'],
    requestParams: { id: z.string().uuid() },
    responseSchema: PromotionSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new PromotionService({ logger: apiLogger });
        const result = await service.softDelete(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
