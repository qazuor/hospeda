import { PaymentMethodHttpCreateSchema, PaymentMethodSchema } from '@repo/schemas';
import { PaymentMethodService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const paymentMethodCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create payment method',
    description: 'Creates a new payment method entity',
    tags: ['Payment Methods'],
    requestBody: PaymentMethodHttpCreateSchema,
    responseSchema: PaymentMethodSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        const service = new PaymentMethodService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof PaymentMethodHttpCreateSchema>;

        const result = await service.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
