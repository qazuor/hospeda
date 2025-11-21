import { z } from '@hono/zod-openapi';
import { InvoiceSchema } from '@repo/schemas';
import { InvoiceService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete invoice',
    description: 'Soft deletes an invoice',
    tags: ['Invoices'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: InvoiceSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceService({ logger: apiLogger });
        const result = await service.softDelete(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
