import { PermissionEnum, SubscriptionOpenRefundsResponseSchema } from '@repo/schemas';
import { entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';
import { readSubscription } from '../read-subscription';
import { readOpenRefunds } from './read-open-refunds';

/**
 * GET /api/v1/admin/billing-subscription/{subscriptionId}/open-refunds — inspect RF1 requests
 * after a reload while B6 is unavailable; requires BILLING_SUBSCRIPTION_INSPECT.
 */
export const adminSubscriptionOpenRefundsRoute = createAdminRoute({
    method: 'get',
    path: '/{subscriptionId}/open-refunds',
    summary: 'Read open refund requests of a subscription',
    description: 'Reads REQUESTED refund requests attached to payments of one subscription.',
    tags: ['Billing subscriptions', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: { subscriptionId: z.string().uuid() },
    responseSchema: SubscriptionOpenRefundsResponseSchema,
    handler: async (ctx, params) => {
        const actor = getActorFromContext(ctx);
        const found = await readSubscription(params.subscriptionId as string);
        if (!found) throw entityNotFoundError({ entityName: 'Subscription' });
        const { items } = await readOpenRefunds({ subscriptionId: found.row.id });
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'subscription',
            resourceId: found.row.id,
            metadata: { subjectId: found.subjectId }
        });
        return { items };
    }
});
