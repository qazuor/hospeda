import { InvoiceLineModel } from '@repo/db';
import { InvoiceLineHttpSearchSchema, InvoiceLineSchema } from '@repo/schemas';
import { InvoiceLineService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const invoiceLineListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List invoice lines',
    description: 'Returns a paginated list of invoice lines with filtering options',
    tags: ['Invoice Lines'],
    requestQuery: InvoiceLineHttpSearchSchema.shape,
    responseSchema: InvoiceLineSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const service = new InvoiceLineService({ logger: apiLogger }, new InvoiceLineModel());
        const result = await service.search(actor, query || {});

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
