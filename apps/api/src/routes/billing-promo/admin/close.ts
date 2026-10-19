import {
    AdminPromoCodeCloseResponseSchema,
    AdminPromoCodeParamsSchema,
    PermissionEnum
} from '@repo/schemas';
import { closePromoCode } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createAdminRoute } from '../../../utils/route-factory';
import { answerPromoCodeRejection } from './rejections';

export const adminClosePromoCodeRoute = createAdminRoute({
    method: 'post',
    path: '/{promoCodeId}/close',
    summary: 'Close a promotional code',
    description: 'Stops new redemptions of a promotional code through admin action 21.',
    tags: ['Billing promo codes'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES],
    requestParams: AdminPromoCodeParamsSchema.shape,
    responseSchema: AdminPromoCodeCloseResponseSchema,
    successStatusCode: 200,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const { promoCodeId } = AdminPromoCodeParamsSchema.parse(params);
        const actor = getActorFromContext(ctx);
        try {
            const result = await closePromoCode(
                { actor, promoCodeId },
                { clock: getClock().clock }
            );
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'promo_code',
                resourceId: result.promoCodeId,
                metadata: {
                    administrativeAction: 'ACC_21',
                    operation: 'close',
                    redemptionCount: result.redemptionCount
                }
            });
            return { ...result, closedAt: result.closedAt.toISOString() };
        } catch (error) {
            return answerPromoCodeRejection({ error, ctx });
        }
    }
});
