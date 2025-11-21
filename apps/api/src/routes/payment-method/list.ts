import { PaymentMethodHttpSearchSchema, PaymentMethodSchema } from '@repo/schemas';
import { PaymentMethodService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../utils/pagination';
import { createListRoute } from '../../utils/route-factory';

export const paymentMethodListRoute = createListRoute({
    method: 'get',
    path: '/',
    summary: 'List payment methods',
    description: 'Returns a paginated list of payment methods with filtering options',
    tags: ['Payment Methods'],
    requestQuery: PaymentMethodHttpSearchSchema.shape,
    responseSchema: PaymentMethodSchema,
    handler: async (ctx: Context, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const service = new PaymentMethodService({ logger: apiLogger });
        const result = await service.list(actor, query || {});

        if (result.error) {
            throw new Error(result.error.message);
        }

        return {
            items: result.data?.items || [],
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    }
});
