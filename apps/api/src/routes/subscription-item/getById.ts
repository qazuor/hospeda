import { SubscriptionItemSchema } from '@repo/schemas';
import { SubscriptionItemService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionItemGetByIdRoute = createCRUDRoute({
    method: 'get',
    path: '//:id',
    summary: 'Get subscription item by ID',
    description: 'Retrieves a single subscription item by their unique identifier',
    tags: ['Subscription Items'],
    requestParams: {
        id: z.string().uuid()
    },
    responseSchema: SubscriptionItemSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new SubscriptionItemService({ logger: apiLogger });
        const result = await service.getById(actor, id as string);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Subscription item not found');
        }

        return result.data;
    }
});
