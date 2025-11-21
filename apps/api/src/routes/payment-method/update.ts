import { z } from '@hono/zod-openapi';
import { PaymentMethodHttpUpdateSchema, PaymentMethodSchema } from '@repo/schemas';
import { PaymentMethodService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const paymentMethodUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update payment method',
    description: 'Updates an existing payment method',
    tags: ['Payment Methods'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: PaymentMethodHttpUpdateSchema,
    responseSchema: PaymentMethodSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PaymentMethodService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof PaymentMethodHttpUpdateSchema>;
        const result = await service.update(actor, id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
