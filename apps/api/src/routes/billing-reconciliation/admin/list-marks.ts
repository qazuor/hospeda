import {
    ActionableReconciliationMarkSchema,
    PermissionEnum,
    ReconciliationMarkListQuerySchema
} from '@repo/schemas';
import { listActionableReconciliationMarks } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

export const listReconciliationMarksRoute = createAdminListRoute({
    method: 'get',
    path: '/marks',
    summary: 'List actionable reconciliation marks',
    description: 'Reads open reconciliation marks and their attached payment evidence.',
    tags: ['Billing reconciliation'],
    requiredPermissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
    requestQuery: ReconciliationMarkListQuerySchema.shape,
    responseSchema: ActionableReconciliationMarkSchema,
    handler: async (ctx, _params, _body, query) => {
        const page = Number(query?.page ?? 1);
        const pageSize = Number(query?.pageSize ?? 50);
        const result = await listActionableReconciliationMarks({ page, pageSize });
        const actor = getActorFromContext(ctx);
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'reconciliation_mark',
            resourceId: 'open',
            metadata: { subjectId: null }
        });
        return {
            items: result.items.map((item) => ({
                ...item,
                openedAt: item.openedAt.toISOString(),
                payments: item.payments.map((payment) => ({
                    ...payment,
                    hungAt: payment.hungAt.toISOString(),
                    resolvedAt: payment.resolvedAt?.toISOString() ?? null
                }))
            })),
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    }
});
