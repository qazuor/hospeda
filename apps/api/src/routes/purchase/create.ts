import { type PurchaseCreateHttp, PurchaseCreateHttpSchema, PurchaseSchema } from '@repo/schemas';
import { PurchaseService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const purchaseCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create purchase',
    description: 'Creates a new purchase entity',
    tags: ['Purchases'],
    requestBody: PurchaseCreateHttpSchema,
    responseSchema: PurchaseSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        const service = new PurchaseService({ logger: apiLogger });
        const result = await service.create(actor, body as PurchaseCreateHttp);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
