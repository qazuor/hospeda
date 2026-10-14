import type { Clock } from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import { ServiceError } from '../../../types';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';

const logger = createLogger('reactivate-suspended');
/** HOS-1548: hanging the same payment twice on the same mark is refused; a replay must not fail S7. */
const MARK_PAYMENT_ALREADY_HUNG = 'MARK_PAYMENT_ALREADY_HUNG';

/** The subset of S7's ports that opening reason 7 needs. */
export interface LatePaymentRejectedMarkPorts {
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly actorType?: 'provider' | 'job';
}

/**
 * Opens reason 7 `PAGO_TARDIO_RECHAZADO` with the payment hung (I-3), outside the
 * row's transaction (S7, AC:B7:13). A payment already hung on that mark (a replayed
 * notice) is logged and not retried; any other error is thrown.
 *
 * @param input.subscriptionId - The suspended row the late payment belongs to
 * @param input.paymentId - The credited payment that could not reactivate it
 * @param input.ports - Clock, mark payment port and actor type of S7
 */
export async function openLatePaymentRejectedMark(input: {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly ports: LatePaymentRejectedMarkPorts;
}): Promise<void> {
    const { ports } = input;
    try {
        await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId: input.subscriptionId },
                reason: 'PAGO_TARDIO_RECHAZADO',
                payment: { source: 'PAYMENT', id: input.paymentId },
                actor: { type: ports.actorType ?? 'provider' },
                correlationId: input.paymentId
            },
            {
                markPayments:
                    ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock)
            }
        );
    } catch (error) {
        if (error instanceof ServiceError && error.reason === MARK_PAYMENT_ALREADY_HUNG) {
            logger.info(
                { subscriptionId: input.subscriptionId, paymentId: input.paymentId },
                'Late payment already hung on its reason 7 mark'
            );
            return;
        }
        throw error;
    }
}
