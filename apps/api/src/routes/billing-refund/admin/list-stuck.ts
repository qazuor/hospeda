import { PermissionEnum, StuckRefundListQuerySchema, StuckRefundSchema } from '@repo/schemas';
import { listStuckRefunds } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

/**
 * GET /api/v1/admin/billing-refunds/stuck — `CONFIRMED` refunds stuck on a live provider call
 * (HOS-2560), each with its call tally and the suggested exit: «Retry with MP» or the remainder
 * settlement. Read-only; it requires the permission of the retry it feeds.
 */
export const adminListStuckRefundsRoute = createAdminListRoute({
    method: 'get',
    path: '/stuck',
    summary: 'List refunds stuck on a provider call (HOS-2560)',
    description:
        'Lists CONFIRMED refunds with a provider call that was accepted or never answered, with the unanswered call count, the oldest unanswered call and the suggested action.',
    tags: ['Billing refunds', 'Admin'],
    requiredPermissions: [PermissionEnum.BILLING_REFUND],
    requestQuery: StuckRefundListQuerySchema.shape,
    responseSchema: StuckRefundSchema,
    handler: async (ctx, _params, _body, query) => {
        const page = Number(query?.page ?? 1);
        const pageSize = Number(query?.pageSize ?? 50);
        const result = await listStuckRefunds({ page, pageSize, now: getClock().clock.now() });
        const actor = getActorFromContext(ctx);
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'refund',
            resourceId: 'stuck',
            metadata: { subjectId: null }
        });
        return {
            items: result.items.map((item) => ({
                ...item,
                createdAt: item.createdAt.toISOString(),
                oldestUnansweredAt: item.oldestUnansweredAt?.toISOString() ?? null
            })),
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    }
});
