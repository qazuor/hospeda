import { addonProducts, eq, getDb } from '@repo/db';
import {
    AddonPurchaseRequestSchema,
    AddonPurchaseResponseSchema,
    ServiceErrorCode
} from '@repo/schemas';
import {
    confirmOneTimeOrder,
    purchaseAddon,
    readAddonPurchase,
    ServiceError,
    sendOneTimeOrder
} from '@repo/service-core';
import { getActorFromContext, isGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { createErrorResponse } from '../../utils/response-helpers';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildAddonPurchasePorts } from './purchase-ports';
import { answerAddonProviderError, answerPurchaseRefusal } from './purchase-rejections';

/** Buy an addon for the current actor; order sending stays outside A1's transaction. */
export const protectedAddonPurchaseRoute = createProtectedRoute({
    method: 'post',
    path: '/purchases',
    summary: 'Purchase an addon',
    description: 'Creates or resumes the actor addon purchase request.',
    tags: ['Billing addons'],
    requestBody: AddonPurchaseRequestSchema,
    responseSchema: AddonPurchaseResponseSchema,
    successStatusCode: (result) => {
        const response = AddonPurchaseResponseSchema.parse(result);
        if (response.processing && response.order) return 202;
        return response.outcome === 'CREATED' ? 201 : 200;
    },
    options: {
        middlewares: [
            async (ctx, next) => {
                if (isGuestActor(getActorFromContext(ctx)))
                    throw new ServiceError(
                        ServiceErrorCode.UNAUTHORIZED,
                        'Authentication required'
                    );
                await next();
            }
        ]
    },
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = AddonPurchaseRequestSchema.parse(body);
        const [product] = await getDb()
            .select({ chargeKind: addonProducts.chargeKind })
            .from(addonProducts)
            .where(eq(addonProducts.id, parsed.productId))
            .limit(1);
        if (product?.chargeKind === 'UNA_VEZ' && (!parsed.payment || !parsed.payerEmail)) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Payment and payer email are required for one-time addons'
                },
                ctx,
                400
            );
        }
        if (product?.chargeKind === 'PERIODICO' && parsed.payment) {
            return createErrorResponse(
                {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: 'Payment details are not accepted for recurring addons'
                },
                ctx,
                400
            );
        }
        const ports = buildAddonPurchasePorts();
        try {
            const result = await purchaseAddon(
                {
                    ownerId: actor.id,
                    productId: parsed.productId,
                    targetId: parsed.targetId,
                    orderRequestId: parsed.orderRequestId,
                    expectedAddonVersionId: parsed.addonVersionId,
                    payerEmail: parsed.payerEmail,
                    returnUrl: env.HOSPEDA_SITE_URL
                },
                ports
            );
            if (result.outcome === 'REFUSED')
                return answerPurchaseRefusal({ reason: result.reason, ctx });
            if (result.outcome === 'PENDING_ELSEWHERE') return { ...result, processing: true };
            if (result.chargeKind === 'PERIODICO') return { ...result, processing: false };
            if (result.outcome === 'EXISTING') {
                const prior = await readAddonPurchase({
                    ownerId: actor.id,
                    orderRequestId: parsed.orderRequestId
                });
                if (prior?.status === 'ACTIVE')
                    return {
                        ...result,
                        processing: false,
                        order: { outcome: 'ORDER_ALREADY_PLACED' as const }
                    };
            }
            if (!parsed.payment || !parsed.payerEmail)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'One-time payment input missing'
                );
            const order = await sendOneTimeOrder(
                {
                    orderRequestId: parsed.orderRequestId,
                    payerEmail: parsed.payerEmail,
                    payment: parsed.payment
                },
                ports
            );
            let orderOutcome: typeof order.outcome | 'ACTIVATED' | 'NOT_APPROVED' | 'UNKNOWN' =
                order.outcome;
            if (order.outcome === 'ORDER_PLACED' || order.outcome === 'ORDER_ALREADY_PLACED') {
                const confirmation = await confirmOneTimeOrder(
                    { instanceId: result.instanceId },
                    ports
                );
                orderOutcome = confirmation.outcome;
            }
            const current = await readAddonPurchase({
                ownerId: actor.id,
                orderRequestId: parsed.orderRequestId
            });
            return {
                ...result,
                processing: current?.processing ?? orderOutcome !== 'ACTIVATED',
                order: { outcome: orderOutcome }
            };
        } catch (error) {
            return answerAddonProviderError({ error, ctx });
        }
    }
});
