import { InvoiceLineHttpCreateSchema, InvoiceLineSchema } from '@repo/schemas';
import { InvoiceLineService } from '@repo/service-core';
import type { Context } from 'hono';
import type { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceLineCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create invoice line',
    description: 'Creates a new invoice line entity',
    tags: ['Invoice Lines'],
    requestBody: InvoiceLineHttpCreateSchema,
    responseSchema: InvoiceLineSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new InvoiceLineService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const validatedBody = body as z.infer<typeof InvoiceLineHttpCreateSchema>;

        const result = await service.create(actor, validatedBody);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
