import { AdminPromoCodeListQuerySchema, AdminPromoCodeSchema, PermissionEnum } from '@repo/schemas';
import { listPromoCodes } from '@repo/service-core';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { getPaginationResponse } from '../../../utils/pagination';
import { createAdminListRoute } from '../../../utils/route-factory';

export const adminListPromoCodesRoute = createAdminListRoute({
    method: 'get',
    path: '/',
    summary: 'List promotional codes',
    description: 'Lists promotional codes and their current availability for admin action 21.',
    tags: ['Billing promo codes'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES],
    requestQuery: AdminPromoCodeListQuerySchema.shape,
    responseSchema: AdminPromoCodeSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const page = Number(query?.page ?? 1);
        const pageSize = Number(query?.pageSize ?? 50);
        const result = await listPromoCodes({ actor, page, pageSize }, { clock: getClock().clock });
        auditLog({
            auditEvent: AuditEventType.BILLING_READ,
            actorId: actor.id,
            resourceType: 'promo_code',
            resourceId: 'list',
            metadata: { subjectId: null }
        });
        return {
            items: result.items.map((item) => ({
                ...item,
                validFrom: item.validFrom.toISOString(),
                validUntil: item.validUntil?.toISOString() ?? null,
                closedAt: item.closedAt?.toISOString() ?? null,
                createdAt: item.createdAt.toISOString()
            })),
            pagination: getPaginationResponse(result.total, { page, pageSize })
        };
    }
});
