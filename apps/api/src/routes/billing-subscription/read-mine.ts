import { OwnSubscriptionsResponseSchema, PermissionEnum } from '@repo/schemas';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';
import { readOwnSubscriptions } from './read-own-subscriptions';

/** List only the authenticated owner's cancellable principal subscriptions. */
export const protectedReadOwnSubscriptionsRoute = createProtectedRoute({
    method: 'get',
    path: '/',
    summary: 'Read own subscriptions',
    description: 'Returns the principal subscriptions owned by the authenticated account.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    responseSchema: OwnSubscriptionsResponseSchema,
    handler: async (ctx) => ({
        subscriptions: (await readOwnSubscriptions(getActorFromContext(ctx).id)).map((row) => ({
            ...row,
            serviceEndsAt: row.serviceEndsAt?.toISOString() ?? null,
            graceEndsAt: row.graceEndsAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString()
        }))
    })
});
