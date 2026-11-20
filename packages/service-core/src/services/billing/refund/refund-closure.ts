import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import {
    type ApplyExecutedRefundResult,
    applyExecutedRefund
} from '../payment/apply-executed-refund.service';
import { resolveHungPaymentsBySettlement } from '../reconciliation/hung-payment-resolution';
import { enqueueLatePaymentRefundNotice } from './late-payment-refund-notice';

/**
 * The effects of a `CONFIRMED` payment refund that just became `EXECUTED`, in the caller's
 * transaction (TRANS:B:RF3): every payment hung on a reconciliation mark for this payment is
 * resolved with the refund (which is what lets a held page-charge mark be lifted), the buyer of
 * a late one-time charge a mark 23 holds is mailed (HOS-2179 D3), and P3/P4/P5 applies the
 * refund to the payment. RF3 and the remainder settlement (HOS-2406) close through here.
 *
 * @param input.tx - The transaction holding the payment and the refund `FOR UPDATE`.
 * @param input.paymentId - The refunded provider payment.
 * @param input.refundId - The refund that is now `EXECUTED`.
 * @param input.clock - The clock.
 * @returns What applying the refund did to the payment.
 */
export async function closeExecutedPaymentRefund(input: {
    readonly tx: DrizzleClient;
    readonly paymentId: string;
    readonly refundId: string;
    readonly clock: Clock;
}): Promise<ApplyExecutedRefundResult> {
    const { tx, paymentId, refundId, clock } = input;
    await resolveHungPaymentsBySettlement({
        tx,
        payment: { source: 'PAYMENT', id: paymentId },
        refundId,
        at: clock.now()
    });
    await enqueueLatePaymentRefundNotice({ tx, refundId, paymentId });
    return applyExecutedRefund({ refundId }, { clock, tx });
}
