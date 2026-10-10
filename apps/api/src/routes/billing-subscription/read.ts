import { PermissionEnum, SubscriptionReadSchema } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';
import { readSubscription } from './read-subscription';

/** Read one subscription belonging to the authenticated account. */
export const protectedReadSubscriptionRoute = createProtectedRoute({
    method: 'get',
    path: '/{subscriptionId}',
    summary: 'Read own subscription',
    description: 'Returns one subscription belonging to the authenticated account.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    requestParams: { subscriptionId: z.string().uuid() },
    responseSchema: SubscriptionReadSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const found = await readSubscription(params.subscriptionId as string);
        if (!found || found.subjectId !== actor.id) {
            throw entityNotFoundError({ entityName: 'Subscription' });
        }
        return found.row;
    }
});
