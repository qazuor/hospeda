import { z } from '@hono/zod-openapi';
import { InvoiceLineModel } from '@repo/db';
import { InvoiceLineHttpUpdateSchema, InvoiceLineSchema } from '@repo/schemas';
import { InvoiceLineService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceLineUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update invoice line',
    description: 'Updates an existing invoice line',
    tags: ['Invoice Lines'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: InvoiceLineHttpUpdateSchema,
    responseSchema: InvoiceLineSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceLineService({ logger: apiLogger }, new InvoiceLineModel());
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof InvoiceLineHttpUpdateSchema>;
        const result = await service.update(actor, id as string, validatedBody);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return result.data;
    }
});
