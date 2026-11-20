import { OwnSubscriptionsResponseSchema, PermissionEnum } from '@repo/schemas';
import { readOwnPlanState } from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { getClock } from '../../utils/clock';
import { createProtectedRoute } from '../../utils/route-factory';
import { readOwnDeclinedSignups } from './read-own-declined-signups';

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
        // HOS-2328: the shared plan-state reader (also behind `get_my_plan`). Its
        // `planVersionId` is for the assistant; this response does not carry it.
        const [{ subscriptions, deferredCourtesies }, declined] = await Promise.all([
            readOwnPlanState({ userId, now: getClock().clock.now() }),
            readOwnDeclinedSignups(userId)
        ]);
        return {
            subscriptions: subscriptions.map(({ planVersionId: _planVersionId, ...row }) => ({
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
            deferredCourtesies,
            declinedSignups: declined.map((notice) => ({
                ...notice,
                declinedAt: notice.declinedAt.toISOString()
            }))
        };
    }
});
