import { z } from '@hono/zod-openapi';
import { DiscountCodeSchema, HttpUpdateDiscountCodeSchema } from '@repo/schemas';
import { DiscountCodeService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const discountCodeUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update discount code',
    description: 'Updates an existing discount code',
    tags: ['Discount Codes'],
    requestParams: { id: z.string().uuid() },
    requestBody: HttpUpdateDiscountCodeSchema,
    responseSchema: DiscountCodeSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new DiscountCodeService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof HttpUpdateDiscountCodeSchema>;
        const result = await service.update(actor, params.id as string, validatedBody);
        if (result.error) throw new Error(result.error.message);
        return result.data;
    }
});
