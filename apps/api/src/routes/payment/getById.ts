import { z } from '@hono/zod-openapi';
import { PaymentSchema } from '@repo/schemas';
import { PaymentService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const paymentGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get payment by ID',
    description: 'Returns a single payment by ID',
    tags: ['Payments'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: PaymentSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PaymentService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
