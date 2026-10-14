import { type ReconciliationMarkReason, reconciliationMarkModel } from '@repo/db';
import { ServiceError } from '../../../../types';
import { openReconciliationMark } from '../open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port';

/** Reason 17: the payer disputed a credited charge with their bank (MOT:17). */
const CHARGEBACK_REASON = 'CONTRACARGO' as const satisfies ReconciliationMarkReason;

/** The credited payment states a chargeback applies to (AC:B11:27). */
const CREDITED_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

const MARK_PAYMENT_ALREADY_HUNG = 'MARK_PAYMENT_ALREADY_HUNG';

/** One read of `charged_back` on our payment, by the notice or by the sweep. */
export interface ChargebackDetectionInput {
    readonly payment: {
        readonly id: string;
        readonly subscriptionId: string | null;
        readonly status: string;
    };
    /** Who read it: the notice receiver (`provider`) or the sweep (`job`). */
    readonly actor: 'provider' | 'job';
    readonly correlationId: string;
}

/** What the chargeback interface did with one read. */
export interface ChargebackDetectionResult {
    readonly outcome: 'MARKED' | 'ALREADY_MARKED' | 'NOT_APPLICABLE';
    /** The reason-17 mark the payment hangs on, when this call opened or accumulated it. */
    readonly markId?: string;
}

/**
 * The ONE internal chargeback interface both reads call (AC:B11:27, pattern BL):
 * the notice receiver and the credited-payments check of the sweep.
 */
export interface ChargebackDetection {
    detect(input: ChargebackDetectionInput): Promise<ChargebackDetectionResult>;
}

/**
 * The cut's implementation of {@link ChargebackDetection} (AC:B11:27, pattern BL,
 * owner decision CY): S14 opens reason 17 `CONTRACARGO` with the payment hung, or
 * hangs it on the open one, and nothing else. It does not move the payment or the
 * subscription, writes no `covered_period`, enqueues no mail, calls no provider
 * and runs no P6, S6 or S12. A payment that already hung on a reason-17 mark of
 * its subscription, open or lifted, is left alone (HOS-1605 H6).
 *
 * Phase 2 replaces the body of this factory (P6/P7, S6 by its third event, S12,
 * the mails and the dispute re-read) without touching its callers.
 *
 * @param ports.markPayments - The port S14 hangs the payment with
 * @returns The cut's chargeback detection
 */
export function createChargebackDetection(ports: {
    readonly markPayments?: ReconciliationMarkPayments;
}): ChargebackDetection {
    return {
        async detect(input) {
            const { payment } = input;
            const subscriptionId = payment.subscriptionId;
            if (
                subscriptionId === null ||
                !(CREDITED_STATUSES as readonly string[]).includes(payment.status)
            )
                return { outcome: 'NOT_APPLICABLE' };
            const alreadyHung = await reconciliationMarkModel.hasPaymentHungOnReason({
                subscriptionId,
                paymentId: payment.id,
                reason: CHARGEBACK_REASON
            });
            if (alreadyHung) return { outcome: 'ALREADY_MARKED' };
            try {
                const opened = await openReconciliationMark(
                    {
                        subject: { kind: 'SUBSCRIPTION', subscriptionId },
                        reason: CHARGEBACK_REASON,
                        payment: { source: 'PAYMENT', id: payment.id },
                        actor: { type: input.actor },
                        correlationId: input.correlationId
                    },
                    { markPayments: ports.markPayments }
                );
                return { outcome: 'MARKED', markId: opened.mark.id };
            } catch (error) {
                if (error instanceof ServiceError && error.reason === MARK_PAYMENT_ALREADY_HUNG)
                    return { outcome: 'ALREADY_MARKED' };
                throw error;
            }
        }
    };
}
