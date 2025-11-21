import { z } from '@hono/zod-openapi';
import { PaymentSchema, PaymentUpdateHttpSchema, httpToDomainPaymentUpdate } from '@repo/schemas';
import { PaymentService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const paymentUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update payment',
    description: 'Updates an existing payment',
    tags: ['Payments'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: PaymentUpdateHttpSchema,
    responseSchema: PaymentSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PaymentService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof PaymentUpdateHttpSchema>;

        // Convert HTTP data to domain format
        const domainData = httpToDomainPaymentUpdate(validatedBody);

        const result = await service.update(actor, id as string, domainData);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
