import { randomUUID } from 'node:crypto';
import {
    CyclePriceConfirmationSchema,
    CyclePricePreviewRequestSchema,
    CyclePriceSetResponseSchema,
    PermissionEnum,
    SetCyclePriceRequestSchema
} from '@repo/schemas';
import { previewCyclePrice, setCyclePrice } from '@repo/service-core';
import type { Context } from 'hono';
import { getRequestCorrelationId } from '../../../lib/request-context.js';
import { getActorFromContext } from '../../../utils/actor.js';
import { AuditEventType, auditLog } from '../../../utils/audit-logger.js';
import { createRouter } from '../../../utils/create-app.js';
import { createAdminRoute } from '../../../utils/route-factory.js';
import { answerCyclePriceRejection } from './rejections.js';

/** Preview the price change and its customer reach before confirmation. */
export const adminPreviewCyclePriceRoute = createAdminRoute({
    method: 'post',
    path: '/preview',
    successStatusCode: 200,
    summary: 'Preview a billing cycle price',
    description: 'Shows the previous and proposed amount for a plan version with no customers.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_SET_CYCLE_PRICE],
    requestBody: CyclePricePreviewRequestSchema,
    responseSchema: CyclePriceConfirmationSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            return await previewCyclePrice({ actor: getActorFromContext(ctx), input: body });
        } catch (error) {
            return answerCyclePriceRejection({ error, ctx });
        }
    }
});

/** Confirm and audit the cycle price change. */
export const adminSetCyclePriceRoute = createAdminRoute({
    method: 'post',
    path: '/',
    successStatusCode: 200,
    summary: 'Set a billing cycle price',
    description: 'Sets one cycle price on a plan version with no customers.',
    tags: ['Billing'],
    requiredPermissions: [PermissionEnum.BILLING_SET_CYCLE_PRICE],
    requestBody: SetCyclePriceRequestSchema,
    responseSchema: CyclePriceSetResponseSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        try {
            const actor = getActorFromContext(ctx);
            const result = await setCyclePrice({
                actor,
                input: body,
                correlationId: getRequestCorrelationId() ?? randomUUID()
            });
            auditLog({
                auditEvent: AuditEventType.BILLING_MUTATION,
                actorId: actor.id,
                action: 'update',
                resourceType: 'billing-option',
                resourceId: result.billingOption.id,
                metadata: {
                    administrativeAction: 'ACC_19',
                    planVersionId: result.billingOption.planVersionId,
                    cycle: result.billingOption.cycle,
                    previousAmount: result.previousAmount,
                    newAmount: result.newAmount,
                    currency: 'ARS'
                }
            });
            return result;
        } catch (error) {
            return answerCyclePriceRejection({ error, ctx });
        }
    }
});

const router = createRouter();
router.route('/', adminPreviewCyclePriceRoute);
router.route('/', adminSetCyclePriceRoute);

export { router as adminBillingPriceRoutes };
