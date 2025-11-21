import { z } from '@hono/zod-openapi';
import { PaymentMethodSchema } from '@repo/schemas';
import { PaymentMethodService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const paymentMethodGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get payment method by ID',
    description: 'Returns a single payment method by ID',
    tags: ['Payment Methods'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: PaymentMethodSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PaymentMethodService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
