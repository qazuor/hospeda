import {
    addonInstances,
    addonProducts,
    and,
    eq,
    getDb,
    idempotencyKeys,
    isNull,
    or
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { PaymentProviderError } from '@repo/payments';
import {
    type SendOneTimeOrderInput,
    SendOneTimeOrderInputSchema,
    type SendOneTimeOrderPorts,
    type SendOneTimeOrderResult
} from './send-one-time-order-types';

const logger = createLogger('send-one-time-order');

/** Sends a pre-keyed one-time order without a local charge clock (AC:B6:11/12, DEC-CONC-001 📌2, MP:EX-41). */
export async function sendOneTimeOrder(
    input: SendOneTimeOrderInput,
    ports: SendOneTimeOrderPorts
): Promise<SendOneTimeOrderResult> {
    const request = SendOneTimeOrderInputSchema.parse(input);
    const [found] = await getDb()
        .select({ instance: addonInstances, product: addonProducts })
        .from(addonInstances)
        .innerJoin(addonProducts, eq(addonInstances.productId, addonProducts.id))
        .where(eq(addonInstances.orderRequestId, request.orderRequestId))
        .limit(1);
    if (
        found?.product.chargeKind !== 'UNA_VEZ' ||
        found.instance.status !== 'PENDING_AUTHORIZATION' ||
        found.instance.orderRequestId === null
    )
        return { instanceId: found?.instance.id ?? null, outcome: 'NOT_APPLICABLE', orderId: null };

    const instanceId = found.instance.id;
    const keys = await getDb()
        .select({ key: idempotencyKeys.key })
        .from(idempotencyKeys)
        .where(
            and(
                eq(idempotencyKeys.operation, 'ORDER_CREATE'),
                eq(idempotencyKeys.subjectId, instanceId)
            )
        );
    const onlyKey = keys[0];
    if (keys.length !== 1 || !onlyKey) {
        logger.error(
            { instanceId, keyCount: keys.length },
            'One-time order requires exactly one persisted key'
        );
        return { instanceId, outcome: 'NOT_APPLICABLE', orderId: null };
    }
    const key = onlyKey.key;
    if (found.instance.providerOrderId !== null)
        return {
            instanceId,
            outcome: 'ORDER_ALREADY_PLACED',
            orderId: found.instance.providerOrderId
        };

    let answer: Awaited<ReturnType<SendOneTimeOrderPorts['provider']['chargeOnce']>>;
    try {
        answer = await ports.provider.chargeOnce({
            reference: found.instance.orderRequestId,
            idempotencyKey: key,
            amount: { amountMinor: found.product.price, currency: found.product.currency },
            payerEmail: request.payerEmail,
            paymentToken: request.payment.token,
            paymentBrand: request.payment.brand,
            paymentKind: request.payment.kind
        });
    } catch (error) {
        if (!(error instanceof PaymentProviderError))
            return { instanceId, outcome: 'AWAITING_PROVIDER_ANSWER', orderId: null };
        if (error.code === 'REJECTED' && error.refundRefusal === 'KEY_REUSED')
            return { instanceId, outcome: 'PREVIOUS_PAYMENT_PROCESSING', orderId: null };
        if (error.code === 'UNAVAILABLE')
            return { instanceId, outcome: 'AWAITING_PROVIDER_ANSWER', orderId: null };
        logger.error({ instanceId, code: error.code }, 'One-time order rejected by provider');
        return { instanceId, outcome: 'ORDER_REJECTED', orderId: null };
    }

    const recorded = await getDb().transaction(async (tx) => {
        const rows = await tx
            .update(addonInstances)
            .set({ providerOrderId: answer.orderId })
            .where(
                and(
                    eq(addonInstances.id, instanceId),
                    or(
                        isNull(addonInstances.providerOrderId),
                        eq(addonInstances.providerOrderId, answer.orderId)
                    )
                )
            )
            .returning({ id: addonInstances.id });
        if (rows.length !== 1) return false;
        await tx
            .update(idempotencyKeys)
            .set({
                result: {
                    outcome: answer.declined ? 'DECLINED' : 'PLACED',
                    orderId: answer.orderId
                },
                completedAt: ports.clock.now()
            })
            .where(and(eq(idempotencyKeys.key, key), isNull(idempotencyKeys.completedAt)));
        return true;
    });
    if (!recorded) {
        logger.error(
            { instanceId, orderId: answer.orderId },
            'Another order was recorded for this instance'
        );
        return { instanceId, outcome: 'AWAITING_PROVIDER_ANSWER', orderId: null };
    }
    return {
        instanceId,
        outcome: answer.declined ? 'ORDER_DECLINED' : 'ORDER_PLACED',
        orderId: answer.orderId
    };
}
