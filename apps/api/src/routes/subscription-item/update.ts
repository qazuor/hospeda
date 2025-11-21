import {
    SubscriptionItemSchema,
    type SubscriptionItemUpdateHttp,
    SubscriptionItemUpdateHttpSchema
} from '@repo/schemas';
import { SubscriptionItemService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionItemUpdateRoute = createCRUDRoute({
    method: 'patch',
    path: '//:id',
    summary: 'Update subscription item',
    description: 'Updates an existing subscription item with partial data',
    tags: ['Subscription Items'],
    requestParams: {
        id: z.string().uuid()
    },
    requestBody: SubscriptionItemUpdateHttpSchema,
    responseSchema: SubscriptionItemSchema,
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const { id } = params;

        const service = new SubscriptionItemService({ logger: apiLogger });
        // Cast body to the correct type (it's already validated by the requestBody schema)
        const _validatedBody = body as z.infer<typeof SubscriptionItemUpdateHttpSchema>;
        const result = await service.update(
            actor,
            id as string,
            body as SubscriptionItemUpdateHttp
        );

        if (result.error) {
            throw new Error(result.error.message);
        }

        if (!result.data) {
            throw new Error('Subscription item not found');
        }

        return result.data;
    }
});
