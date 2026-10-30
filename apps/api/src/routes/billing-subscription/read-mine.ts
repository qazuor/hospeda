import { OwnSubscriptionsResponseSchema, PermissionEnum } from '@repo/schemas';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';
import { readOwnDeferredCourtesies, readOwnSubscriptions } from './read-own-subscriptions';

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
    handler: async (ctx) => {
        const userId = getActorFromContext(ctx).id;
        const [subscriptions, deferredCourtesies] = await Promise.all([
            readOwnSubscriptions(userId),
            readOwnDeferredCourtesies(userId)
        ]);
        return {
            subscriptions: subscriptions.map((row) => ({
                ...row,
                serviceEndsAt: row.serviceEndsAt?.toISOString() ?? null,
                graceEndsAt: row.graceEndsAt?.toISOString() ?? null,
                createdAt: row.createdAt.toISOString(),
                plan: row.plan,
                nextCharge: row.nextCharge
                    ? { ...row.nextCharge, at: row.nextCharge.at.toISOString() }
                    : null,
                paidAfterCancellation: row.paidAfterCancellation
            })),
            deferredCourtesies
        };
    }
});
