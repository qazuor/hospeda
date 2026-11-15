import { PaymentProviderError } from '../provider/errors';
import type {
    OrderRefund,
    OrderRefundInput,
    OrderRefundResult,
    OrderSnapshot
} from '../provider/payment-provider';
import type { FakeLedger } from './fake-ledger';
import { rejected } from './fake-support';

/** Stored order refund state (MP:EX-58, AC:B6:8, TRANS:B:RF2/RF3). */
export interface FakeRefundableOrder {
    snapshot: OrderSnapshot;
    readonly amountMinor: number;
    readonly currency: string;
    readonly byKey: Map<string, { readonly body: string; readonly photo: OrderRefundResult }>;
}

/** Applies an idempotent order refund and returns the first response photo (MP:EX-58, AC:B6:8, TRANS:B:RF2). */
export function applyFakeOrderRefund(args: {
    readonly order: FakeRefundableOrder;
    readonly input: OrderRefundInput;
    readonly ledger: FakeLedger;
}): OrderRefundResult {
    const { order, input, ledger } = args;
    const body =
        input.scope.kind === 'total'
            ? ''
            : JSON.stringify({
                  transactions: [
                      {
                          id: input.scope.transactionId,
                          amount: (input.scope.amount.amountMinor / 100).toFixed(2)
                      }
                  ]
              });
    const prior = order.byKey.get(input.reference);
    if (prior) {
        if (prior.body !== body)
            throw new PaymentProviderError({
                code: 'REJECTED',
                capability: 'refund',
                message: 'the key was already used for another body',
                refundRefusal: 'KEY_REUSED'
            });
        return structuredClone(prior.photo);
    }
    if (!order.snapshot.hasApprovedPayment)
        throw rejected({ capability: 'refund', reason: 'order has no approved payment' });
    const refunded = order.snapshot.refunds.reduce((sum, refund) => sum + refund.amountMinor, 0);
    const balance = order.amountMinor - refunded;
    if (
        input.scope.kind === 'partial' &&
        input.scope.transactionId !== order.snapshot.paymentTransactionId
    )
        throw rejected({
            capability: 'refund',
            reason: 'payment transaction does not belong to order'
        });
    if (input.scope.kind === 'partial' && input.scope.amount.currency !== order.currency)
        throw rejected({ capability: 'refund', reason: 'refund currency differs from order' });
    const amountMinor = input.scope.kind === 'total' ? balance : input.scope.amount.amountMinor;
    if (amountMinor <= 0 || amountMinor > balance)
        throw rejected({ capability: 'refund', reason: 'refund exceeds order balance' });
    const refund: OrderRefund = {
        refundId: ledger.nextId({ prefix: 'order-refund' }),
        amountMinor,
        accredited: true
    };
    order.snapshot = { ...order.snapshot, refunds: [...order.snapshot.refunds, refund] };
    const photo = { refunds: structuredClone(order.snapshot.refunds) };
    order.byKey.set(input.reference, { body, photo });
    return structuredClone(photo);
}

/** Holds one accepted refund as pending for a provider read (AC:B6:8, TRANS:B:RF3). */
export function holdFakeOrderRefund(args: {
    readonly order: FakeRefundableOrder;
    readonly refundId: string;
}): void {
    const found = args.order.snapshot.refunds.find((refund) => refund.refundId === args.refundId);
    if (!found?.accredited)
        throw rejected({ capability: 'refund', reason: 'refund is absent or already pending' });
    args.order.snapshot = {
        ...args.order.snapshot,
        refunds: args.order.snapshot.refunds.map((refund) =>
            refund.refundId === args.refundId ? { ...refund, accredited: false } : refund
        )
    };
}
