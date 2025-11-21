import { SubscriptionSchema } from '@repo/schemas';
import { SubscriptionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get subscription by ID',
    description: 'Retrieves a single subscription by their unique identifier',
    tags: ['Subscriptions'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: SubscriptionSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new SubscriptionService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Subscription not found');
        }

        return result.data;
    }
});
