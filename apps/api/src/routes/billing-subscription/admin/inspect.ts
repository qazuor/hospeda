import { PermissionEnum, SubscriptionReadSchema } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createRouter } from '../../../utils/create-app';
import { createAdminRoute } from '../../../utils/route-factory';
import { readSubscription } from '../read-subscription';

/** Inspect one subscription with the entity-specific permission. */
export const adminInspectSubscriptionRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}',
    summary: 'Inspect subscription',
    description: 'Reads one subscription for administrative inspection.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: { subscriptionId: z.string().uuid() },
    responseSchema: SubscriptionReadSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const found = await readSubscription(params.subscriptionId as string);
        if (!found) {
            throw entityNotFoundError({ entityName: 'Subscription' });
        }
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: found.row.id,
            metadata: { subjectId: found.subjectId }
        });
        return found.row;
    }
});

const router = createRouter();
router.route('/', adminInspectSubscriptionRoute);

export { router as adminBillingSubscriptionRoutes };
