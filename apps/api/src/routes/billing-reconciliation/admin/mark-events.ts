import {
    PermissionEnum,
    ReconciliationMarkEventsResponseSchema,
    ReconciliationMarkParamsSchema,
    ServiceErrorCode
} from '@repo/schemas';
import { readReconciliationMarkEvents, ServiceError } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { createAdminRoute } from '../../../utils/route-factory';

export const readReconciliationMarkEventsRoute = createAdminRoute({
    method: 'get',
    path: '/marks/{markId}/events',
    summary: 'Read reconciliation mark events',
    description: 'Reads critical events associated with a reconciliation mark.',
    tags: ['Billing reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestParams: ReconciliationMarkParamsSchema.shape,
    responseSchema: ReconciliationMarkEventsResponseSchema,
    handler: async (ctx, params) => {
        try {
            const result = await readReconciliationMarkEvents({ markId: String(params.markId) });
            const actor = getActorFromContext(ctx);
            auditLog({
                auditEvent: AuditEventType.BILLING_READ,
                actorId: actor.id,
                resourceType: 'reconciliation_mark',
                resourceId: String(params.markId),
                metadata: { subjectId: String(params.markId) }
            });
            return {
                mark: {
                    ...result.mark,
                    openedAt: result.mark.openedAt.toISOString(),
                    liftedAt: result.mark.liftedAt?.toISOString() ?? null
                },
                events: result.events.map((event) => ({
                    ...event,
                    occurredAt: event.occurredAt.toISOString()
                }))
            };
        } catch (error) {
            if (error instanceof ServiceError && error.reason === 'RECONCILIATION_MARK_NOT_FOUND')
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Reconciliation mark not found');
            throw error;
        }
    }
});
