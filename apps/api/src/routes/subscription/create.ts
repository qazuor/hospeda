import {
    type SubscriptionCreateHttp,
    SubscriptionCreateHttpSchema,
    SubscriptionSchema
} from '@repo/schemas';
import { ServiceError, SubscriptionService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionCreateRoute = createCRUDRoute({
    method: 'post',
    path: '/',
    summary: 'Create subscription',
    description: 'Creates a new subscription entity',
    tags: ['Subscriptions'],
    requestBody: SubscriptionCreateHttpSchema,
    responseSchema: SubscriptionSchema,
    handler: async (ctx: Context, _params, body) => {
        const actor = getActorFromContext(ctx);
        const service = new SubscriptionService({ logger: apiLogger });

        const result = await service.create(actor, body as SubscriptionCreateHttp);

        if (result.error) {
            // Re-throw ServiceError to preserve error code and details
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        // Return Response with 201 Created status for resource creation
        return ctx.json({ success: true, data: result.data }, 201);
    }
});
