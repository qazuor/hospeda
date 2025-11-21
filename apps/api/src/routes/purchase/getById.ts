import { PurchaseSchema } from '@repo/schemas';
import { PurchaseService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const purchaseGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get purchase by ID',
    description: 'Retrieves a single purchase by their unique identifier',
    tags: ['Purchases'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: PurchaseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new PurchaseService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Purchase not found');
        }

        return result.data;
    }
});
