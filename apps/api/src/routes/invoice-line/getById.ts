import { z } from '@hono/zod-openapi';
import { InvoiceLineModel } from '@repo/db';
import { InvoiceLineSchema } from '@repo/schemas';
import { InvoiceLineService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const invoiceLineGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '/:id',
    summary: 'Get invoice line by ID',
    description: 'Returns a single invoice line by ID',
    tags: ['Invoice Lines'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: InvoiceLineSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new InvoiceLineService({ logger: apiLogger }, new InvoiceLineModel());
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return result.data;
    }
});
