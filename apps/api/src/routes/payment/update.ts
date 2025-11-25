import { z } from '@hono/zod-openapi';
import { PaymentSchema, PaymentUpdateHttpSchema, httpToDomainPaymentUpdate } from '@repo/schemas';
import { PaymentService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { transformApiInputToDomain } from '../../utils/openapi-schema';
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

        // Transform API input (string dates) to domain format (Date objects)
        const transformedBody = transformApiInputToDomain(body as Record<string, unknown>);

        // Convert HTTP data to domain format
        const domainData = httpToDomainPaymentUpdate(transformedBody as typeof validatedBody);

        const result = await service.update(actor, id as string, domainData);

        if (result.error) {
            // Re-throw ServiceError to preserve error code and details
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        if (!result.data) {
            throw new ServiceError('NOT_FOUND', 'Payment not found');
        }

        return result.data;
    }
});
