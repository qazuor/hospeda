import { z } from '@hono/zod-openapi';
import { InvoiceLineSchema } from '@repo/schemas';
import { InvoiceLineService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceLineDeleteRoute = createCRUDRoute({
    method: 'delete',
    path: '/:id',
    summary: 'Delete invoice line',
    description: 'Soft deletes an invoice line',
    tags: ['Invoice Lines'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: InvoiceLineSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceLineService({ logger: apiLogger });
        const result = await service.softDelete(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
