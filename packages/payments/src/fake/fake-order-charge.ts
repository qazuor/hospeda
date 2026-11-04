import { PaymentProviderError } from '../provider/errors';
import type { OneTimeChargeInput, OneTimeChargeResult } from '../provider/payment-provider';
import { OneTimeChargeInputSchema, parseProviderInput } from '../provider/schemas';
import type { FakeOrders } from './fake-orders';
import { assertChargeableAmount, assertUnusedPaymentToken } from './fake-rules';
import { throughNetwork } from './fake-support';

/** Applies RP1, RP3, RP4, RP15 and RP16 to one-time order creation (AC:B6:12, MP:EX-41/EX-30). */
export async function chargeFakeOrder(args: {
    readonly input: OneTimeChargeInput;
    readonly orders: FakeOrders;
    readonly simulating: ReadonlySet<string>;
    readonly usedPaymentTokens: Set<string>;
    readonly declinedPaymentTokens: ReadonlySet<string>;
}): Promise<OneTimeChargeResult> {
    const { value: input } = parseProviderInput({
        schema: OneTimeChargeInputSchema,
        input: args.input,
        capability: 'charge'
    });
    return throughNetwork({
        simulating: args.simulating,
        capability: 'charge',
        run: () => createOrder({ ...args, input })
    });
}

function createOrder(args: {
    readonly input: OneTimeChargeInput;
    readonly orders: FakeOrders;
    readonly usedPaymentTokens: Set<string>;
    readonly declinedPaymentTokens: ReadonlySet<string>;
}): OneTimeChargeResult {
    const { input, orders } = args;
    const body = JSON.stringify({
        reference: input.reference,
        amount: input.amount,
        payerEmail: input.payerEmail,
        paymentToken: input.paymentToken,
        paymentBrand: input.paymentBrand,
        paymentKind: input.paymentKind
    });
    const prior = orders.chargeByKey.get(input.idempotencyKey);
    if (prior) {
        if (prior.body !== body)
            throw new PaymentProviderError({
                code: 'REJECTED',
                capability: 'charge',
                refundRefusal: 'KEY_REUSED',
                message: 'the order key was already used for another body'
            });
        return { orderId: prior.orderId, declined: prior.declined };
    }
    try {
        assertUnusedPaymentToken({
            paymentToken: input.paymentToken,
            usedTokens: args.usedPaymentTokens
        });
    } catch (cause) {
        throw new PaymentProviderError({
            code: 'REJECTED',
            capability: 'charge',
            message: 'payment token was used',
            cause
        });
    }
    assertChargeableAmount({ amount: input.amount, capability: 'charge' });
    const declined = args.declinedPaymentTokens.has(input.paymentToken);
    const { orderId } = orders.place({
        reference: input.reference,
        paid: !declined,
        amount: input.amount
    });
    args.usedPaymentTokens.add(input.paymentToken);
    orders.chargeByKey.set(input.idempotencyKey, { body, orderId, declined });
    return { orderId, declined };
}
