import { SubscriptionSchema, SubscriptionUpdateHttpSchema } from '@repo/schemas';
import { ServiceError, SubscriptionService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { apiLogger } from '../../utils/logger';
import { transformApiInputToDomain } from '../../utils/openapi-schema';
import { createCRUDRoute } from '../../utils/route-factory';

export const subscriptionUpdateRoute = createCRUDRoute({
    method: 'put',
    path: '/:id',
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

        // Transform API input (string dates) to domain format (Date objects)
        const domainBody = transformApiInputToDomain(body as Record<string, unknown>);

        const result = await service.update(actor, id as string, domainBody);

        if (result.error) {
            // Re-throw ServiceError to preserve error code and details
            throw new ServiceError(result.error.code, result.error.message, result.error.details);
        }

        if (!result.data) {
            throw new ServiceError('NOT_FOUND', 'Subscription not found');
        }

        return result.data;
    }
});
