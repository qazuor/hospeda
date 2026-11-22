import { AddonPurchaseRequestSchema, AddonPurchaseResponseSchema } from '@repo/schemas';
import {
    emitBillingFact,
    type PurchaseAddonResult,
    purchaseAddon,
    readAddonPurchase
} from '@repo/service-core';
import { getActorFromContext } from '../../utils/actor';
import { getAnalyticsFactSink } from '../../utils/analytics/analytics-facts';
import { createProtectedRoute } from '../../utils/route-factory';
import { buildAddonPurchasePorts } from './purchase-ports';
import { answerAddonProviderError, answerPurchaseRefusal } from './purchase-rejections';
import { addonPurchaseReturnUrl } from './purchase-return-url';

/**
 * HOS-1883: emits `addon_checkout_started` for a purchase A1 just created (only after its
 * provider authorization or payment page succeeded: a refusal throws before this point) and
 * strips the fact, which is never part of the answer.
 */
function withoutStartedFact(result: PurchaseAddonResult): PurchaseAddonResult {
    if (result.outcome === 'REFUSED') return result;
    const { startedFact, ...answer } = result;
    if (startedFact) emitBillingFact({ sink: getAnalyticsFactSink(), fact: startedFact });
    return answer;
}

/**
 * Buy an addon for the current actor. A recurring addon gets its provider checkout; a one-time
 * (`UNA_VEZ`) addon gets a Mercado Pago payment page (HOS-2179 §5.1). Either way the answer
 * carries the sanitized link to redirect to, and no payment data ever reaches this route: the
 * request schema is strict and has no field for it (§6.2). The provider is called after A1
 * commits, outside its transaction.
 */
export const protectedAddonPurchaseRoute = createProtectedRoute({
    method: 'post',
    path: '/purchases',
    summary: 'Purchase an addon',
    description:
        'Creates or resumes the actor addon purchase request and returns the provider link to pay it.',
    tags: ['Billing addons'],
    requestBody: AddonPurchaseRequestSchema,
    responseSchema: AddonPurchaseResponseSchema,
    successStatusCode: (result) =>
        AddonPurchaseResponseSchema.parse(result).outcome === 'CREATED' ? 201 : 200,
    handler: async (ctx, _params, body) => {
        const actor = getActorFromContext(ctx);
        const parsed = AddonPurchaseRequestSchema.parse(body);
        const ports = buildAddonPurchasePorts();
        try {
            const purchased = await purchaseAddon(
                {
                    ownerId: actor.id,
                    productId: parsed.productId,
                    targetId: parsed.targetId,
                    orderRequestId: parsed.orderRequestId,
                    expectedAddonVersionId: parsed.addonVersionId,
                    payerEmail: parsed.payerEmail,
                    returnUrl: addonPurchaseReturnUrl({
                        ctx,
                        orderRequestId: parsed.orderRequestId
                    })
                },
                ports
            );
            const result = withoutStartedFact(purchased);
            if (result.outcome === 'REFUSED')
                return answerPurchaseRefusal({ reason: result.reason, ctx });
            if (result.outcome === 'PENDING_ELSEWHERE') return { ...result, processing: true };
            if (result.chargeKind === 'PERIODICO') return { ...result, processing: false };
            // A replayed one-time purchase may be paid already, and one activated while its page
            // was in flight has no link: never hand out a link to pay a settled purchase again
            // (§5.5). A waiting purchase without a link is still processing.
            if (result.outcome === 'EXISTING' || !result.checkoutUrl) {
                const current = await readAddonPurchase({
                    ownerId: actor.id,
                    orderRequestId: parsed.orderRequestId
                });
                if (current && current.status !== 'PENDING_AUTHORIZATION') {
                    const { checkoutUrl: _settledLink, ...settled } = result;
                    return { ...settled, processing: false };
                }
            }
            return { ...result, processing: !result.checkoutUrl };
        } catch (error) {
            return answerAddonProviderError({ error, ctx });
        }
    }
});
