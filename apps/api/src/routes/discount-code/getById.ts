import { z } from '@hono/zod-openapi';
import { DiscountCodeSchema } from '@repo/schemas';
import { DiscountCodeService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const discountCodeGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get discount code by ID',
    description: 'Returns a single discount code by ID',
    tags: ['Discount Codes'],
    requestParams: { id: z.string().uuid() },
    responseSchema: DiscountCodeSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const service = new DiscountCodeService({ logger: apiLogger });
        const result = await service.getById(actor, params.id as string);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
