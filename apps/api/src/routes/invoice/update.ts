import { z } from '@hono/zod-openapi';
import { InvoiceHttpUpdateSchema, InvoiceSchema } from '@repo/schemas';
import { InvoiceService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z as zodType } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
    summary: 'Update invoice',
    description: 'Updates an existing invoice',
    tags: ['Invoices'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: InvoiceHttpUpdateSchema,
    responseSchema: InvoiceSchema,
    handler: async (ctx: Context, params, body) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as zodType.infer<typeof InvoiceHttpUpdateSchema>;
        const result = await service.update(actor, id as string, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
