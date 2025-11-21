import { SubscriptionSchema, SubscriptionUpdateHttpSchema } from '@repo/schemas';
import { SubscriptionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update subscription',
    description: 'Updates an existing subscription with partial data',
    tags: ['Subscriptions'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: SubscriptionUpdateHttpSchema,
    responseSchema: SubscriptionSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new SubscriptionService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof SubscriptionUpdateHttpSchema>;
        const result = await service.update(actor, id as string, body);

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Subscription not found');
        }

        return result.data;
    }
});
