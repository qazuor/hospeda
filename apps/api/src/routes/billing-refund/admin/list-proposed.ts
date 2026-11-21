import { PermissionEnum, ProposedRefundListQuerySchema, ProposedRefundSchema } from '@repo/schemas';
import { listProposedRefunds } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/billing-refunds/proposed — refunds proposed from a reconciliation mark that
 * still wait for administrative action 13, each with the mark(s) that originated it. Read-only; it
 * requires the same permission as the action it feeds.
 */
export const adminListProposedRefundsRoute = createAdminListRoute({
    method: 'get',
    path: '/proposed',
    summary: 'List proposed refunds awaiting confirmation (ACC:13)',
    description:
        'Lists MARK_PROPOSAL refunds that are REQUESTED, or CONFIRMED with no provider call, with their originating marks.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REFUND],
    requestQuery: ProposedRefundListQuerySchema.shape,
    responseSchema: ProposedRefundSchema,
    handler: async (ctx, _params, _body, query) => {
        const page = Number(query?.page ?? 1);
        const pageSize = Number(query?.pageSize ?? 50);
        const result = await listProposedRefunds({ page, pageSize });
        const actor = getActorFromContext(ctx);
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'refund',
            resourceId: 'proposed',
            metadata: { subjectId: null }
        });
        return {
            items: result.items.map((item) => ({
                ...item,
                requestedAt: item.requestedAt.toISOString(),
                marks: item.marks.map((mark) => ({
                    ...mark,
                    openedAt: mark.openedAt.toISOString(),
                    liftedAt: mark.liftedAt?.toISOString() ?? null
                }))
            })),
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    }
});
