import {
    AdminPromoCodeCreateRequestSchema,
    AdminPromoCodeSchema,
    PermissionEnum
} from '@repo/schemas';
import { createPromoCode } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { AuditEventType, auditLog } from '../../../utils/audit-logger';
import { getClock } from '../../../utils/clock';
import { createAdminRoute } from '../../../utils/route-factory';
import { answerPromoCodeRejection } from './rejections';

export const adminCreatePromoCodeRoute = createAdminRoute({
    method: 'post',
    path: '/',
    summary: 'Create a promotional code',
    description: 'Creates a promotional code through admin action 21.',
    tags: ['Billing promo codes'],
    requiredPermissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES],
    requestBody: AdminPromoCodeCreateRequestSchema,
    responseSchema: AdminPromoCodeSchema,
    successStatusCode: 201,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const input = AdminPromoCodeCreateRequestSchema.parse(body);
        const actor = getActorFromContext(ctx);
        try {
            const result = await createPromoCode({ actor, input }, { clock: getClock().clock });
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'create',
                resourceType: 'promo_code',
                resourceId: result.id,
                metadata: {
                    administrativeAction: 'ACC_21',
                    code: result.code,
                    effect: result.effect,
                    allVerticals: result.allVerticals,
                    verticals: result.verticals,
                    totalQuota: result.totalQuota,
                    validFrom: result.validFrom.toISOString(),
                    validUntil: result.validUntil?.toISOString() ?? null
                }
            });
            return {
                ...result,
                validFrom: result.validFrom.toISOString(),
                validUntil: result.validUntil?.toISOString() ?? null,
                closedAt: result.closedAt?.toISOString() ?? null,
                createdAt: result.createdAt.toISOString()
            };
        } catch (error) {
            return answerPromoCodeRejection({ error, ctx });
        }
    }
});
