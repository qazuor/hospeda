import {
    type SubscriptionItemCreateHttp,
    SubscriptionItemCreateHttpSchema,
    SubscriptionItemSchema
} from '@repo/schemas';
import { SubscriptionItemService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionItemCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create subscription item',
    description: 'Creates a new subscription item entity',
    tags: ['Subscription Items'],
    requestBody: SubscriptionItemCreateHttpSchema,
    responseSchema: SubscriptionItemSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);

        const service = new SubscriptionItemService({ logger: apiLogger });
        const result = await service.create(actor, body as SubscriptionItemCreateHttp);

        if (result.error) {
            throw new Error(result.error.message);
        }

        return result.data;
    }
});
