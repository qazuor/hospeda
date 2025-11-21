import { InvoiceHttpCreateSchema, InvoiceSchema } from '@repo/schemas';
import { InvoiceService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create invoice',
    description: 'Creates a new invoice entity',
    tags: ['Invoices'],
    requestBody: InvoiceHttpCreateSchema,
    responseSchema: InvoiceSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new InvoiceService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof InvoiceHttpCreateSchema>;

        const result = await service.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
