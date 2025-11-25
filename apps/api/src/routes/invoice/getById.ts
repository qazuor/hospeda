import { z } from '@hono/zod-openapi';
import { InvoiceModel } from '@repo/db';
import { InvoiceSchema } from '@repo/schemas';
import { InvoiceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get invoice by ID',
    description: 'Returns a single invoice by ID',
    tags: ['Invoices'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: InvoiceSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceService({ logger: apiLogger }, new InvoiceModel());
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return result.data;
    }
});
