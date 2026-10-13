import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { requestRefund } from '../refund/request-refund.service';
import type { RevocablePayment } from './revocation-payment';
import { releaseRetainedPayment } from './succession-retained-payment';

/** Result of {@link requestRevocationRefund}. */
export interface RequestRevocationRefundResult {
    /** The RF1 born for the revoked payment. */
    readonly refundId: string;
    /** True when the payment had an open S19 retention and this act closed it. */
    readonly retentionReleased: boolean;
}

/**
 * S36's RF1 (AC:B5:9) plus the S19 flag off for the payment it returns (AC:B5:23;
 * DEC-RF-001📌5; release reason `REVOCATION_REFUNDED`).
 *
 * Runs in the caller's transaction AFTER the row is `CANCELLED`: the gate
 * `assertRetainedPaymentRefundable` only lets the retained payment through once the
 * retaining row is dead, and any rejection of the RF1 propagates as it is, so the
 * caller's whole act rolls back and the flag stays on. Only the open retention of
 * THIS payment is closed (by `paymentId`), never every retention of the row: another
 * retained payment was not returned by S36 and stays for S18's branch 6. A
 * `MANUAL_PAYMENT` turns nothing off: the manual door of S19 arrives in Phase 4.
 * S18 (HOS-1547) must run after it, so branch 6 finds no open retention and opens no
 * `REEMBOLSO_POR_CONFIRMAR`.
 *
 * @param input.tx - The caller's transaction (the revoked row already `CANCELLED`)
 * @param input.payment - The payment S36 revokes, as `resolveRevokedPayment` read it
 * @param input.now - The instant of the act
 * @param input.clock - The clock of the act
 * @returns The RF1 id and whether an S19 retention was released
 * @throws ServiceError any rejection of `requestRefund`, untouched
 */
export async function requestRevocationRefund(input: {
    readonly tx: DrizzleClient;
    readonly payment: RevocablePayment;
    readonly now: Date;
    readonly clock: Clock;
}): Promise<RequestRevocationRefundResult> {
    const { refundId } = await requestRefund(
        {
            source: input.payment.source,
            amount: input.payment.amount,
            reason: 'REVOCATION'
        },
        { clock: input.clock, tx: input.tx }
    );
    // A manual payment: S19's manual door is Phase 4, so there is no retention to turn off.
    if (input.payment.source.kind !== 'PAYMENT') return { refundId, retentionReleased: false };
    const { released } = await releaseRetainedPayment({
        paymentId: input.payment.source.id,
        reason: 'REVOCATION_REFUNDED',
        now: input.now,
        tx: input.tx
    });
    return { refundId, retentionReleased: released };
}
