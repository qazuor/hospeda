import { type ReconciliationMarkReason, reconciliationMarkModel } from '@repo/db';
import { ServiceError } from '../../../../types';
import {
    type SuspendForChargebackInput,
    type SuspendForChargebackPorts,
    type SuspendForChargebackResult,
    suspendForChargeback
} from '../../subscription/suspend-for-chargeback.service';
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
    /** S6's result when the optional chargeback suspension port is wired. */
    readonly suspension?: SuspendForChargebackResult;
}

/** Optional S6 dispatcher; the default detection retains the mark-only behavior. */
export interface ChargebackSuspension {
    suspend(input: SuspendForChargebackInput): Promise<SuspendForChargebackResult>;
}

/** Builds the optional S6 dispatcher for composition roots. */
export function createChargebackSuspension(ports: SuspendForChargebackPorts): ChargebackSuspension {
    return { suspend: (input) => suspendForChargeback(input, ports) };
}

/**
 * The ONE internal chargeback interface both reads call (AC:B11:27, pattern BL):
 * the notice receiver and the credited-payments check of the sweep.
 */
export interface ChargebackDetection {
    detect(input: ChargebackDetectionInput): Promise<ChargebackDetectionResult>;
}

/**
 * S14 first opens reason 17 with the credited payment, or sees it already hung.
 * With the optional suspension port, S6 then handles its third event on every
 * read, including ALREADY_MARKED, so a deferred notice or cancellation retries.
 * Without that port, the existing mark-only behavior remains (AC:B11:27).
 *
 * @param ports.markPayments - The port S14 hangs the payment with
 * @returns The cut's chargeback detection
 */
export function createChargebackDetection(ports: {
    readonly markPayments?: ReconciliationMarkPayments;
    readonly suspension?: ChargebackSuspension;
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
            const suspend = () => {
                if (!ports.suspension) throw new Error('Chargeback suspension port is not wired');
                return ports.suspension.suspend({
                    subscriptionId,
                    paymentId: payment.id,
                    occurrenceId: payment.id
                });
            };
            // S12 by its second event belongs to HOS-1633 (AC:B8a:7).
            if (alreadyHung)
                return {
                    outcome: 'ALREADY_MARKED',
                    ...(ports.suspension ? { suspension: await suspend() } : {})
                };
            try {
                const opened = await openReconciliationMark(
                    {
                        subject: { kind: 'SUBSCRIPTION', subscriptionId },
                        reason: 'CONTRACARGO' satisfies typeof CHARGEBACK_REASON,
                        payment: { source: 'PAYMENT', id: payment.id },
                        actor: { type: input.actor },
                        correlationId: input.correlationId
                    },
                    { markPayments: ports.markPayments }
                );
                return {
                    outcome: 'MARKED',
                    markId: opened.mark.id,
                    ...(ports.suspension ? { suspension: await suspend() } : {})
                };
            } catch (error) {
                if (error instanceof ServiceError && error.reason === MARK_PAYMENT_ALREADY_HUNG)
                    return {
                        outcome: 'ALREADY_MARKED',
                        ...(ports.suspension ? { suspension: await suspend() } : {})
                    };
                throw error;
            }
        }
    };
}
