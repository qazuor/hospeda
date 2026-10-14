import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, type ReconciliationMarkReason, reconciliationCreditedPaymentModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceError } from '../../../../types';
import type { CanChargeDeadlines } from '../../coverage/can-charge';
import { claimedRefundAmount, lockRefundSource } from '../../refund/refund-source';
import {
    type ChargebackDetection,
    createChargebackDetection
} from '../chargeback/chargeback-detection';
import { openReconciliationMark } from '../open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation-mark-payments.port';
import { reconciliationWindowSince } from './payment-window';

const logger = createLogger('billing-reconciliation-sweep');

/** Reason 18: the provider shows more refunded than our flow claims (MOT:18). */
const OUT_OF_FLOW_REFUND_REASON =
    'REEMBOLSO_FUERA_DEL_FLUJO' as const satisfies ReconciliationMarkReason;

const MARK_PAYMENT_ALREADY_HUNG = 'MARK_PAYMENT_ALREADY_HUNG';

/** Ports of the credited-payments check (AC:B11:12, AC:B11:27). */
export interface CreditedPaymentsCheckPorts {
    /** The internal chargeback interface; defaults to the cut's implementation. */
    readonly chargebacks?: ChargebackDetection;
    /** The billing deadlines (PLAZO:18); defaults to the version in force. */
    readonly deadlines?: CanChargeDeadlines;
}

/** One payment the check could not decide on; `paymentId` is null when the pass never started. */
export interface CreditedPaymentsCheckFailure {
    readonly paymentId: string | null;
    readonly subscriptionId: string | null;
    readonly message: string;
}

/** What one run of the credited-payments check did. */
export interface CreditedPaymentsCheckSummary {
    /** Payments re-read by id. */
    readonly examined: number;
    /** Payments read charged back and handed to the chargeback interface. */
    readonly chargebacks: number;
    /** Reason-18 marks opened or accumulated. */
    readonly outOfFlowRefunds: number;
    /** Payments already hanging on the open reason 18 (HOS-1605 H9). */
    readonly alreadyOpen: number;
    readonly failures: readonly CreditedPaymentsCheckFailure[];
}

function errorMessage(error: unknown): string {
    if (error instanceof ServiceError && error.reason) return `${error.reason}: ${error.message}`;
    return error instanceof Error ? error.message : String(error);
}

/**
 * The credited-payments check of the daily sweep (AC:B11:12; the "by the check"
 * half of AC:B11:27): every credited subscription payment inside the PLAZO:18
 * window is re-read by id. Charged back → the internal chargeback interface and
 * nothing else. Otherwise, refunded by the provider beyond what our flow claims
 * (`REQUESTED` + `CONFIRMED` + `EXECUTED`, HOS-1605 H2) → S14 opens reason 18,
 * without suspending. It never moves a payment or a subscription, writes no
 * refund, calls no refund or cancel and enqueues no mail. A payment that fails is
 * counted and the pass goes on; a window it cannot read fails closed.
 *
 * @param input.correlationId - The sweep's correlation id
 * @param input.pageSize - Payments per page
 * @param ports - The check's ports plus the sweep's provider, clock and S14 port
 * @returns What the pass did
 */
export async function runCreditedPaymentsCheck(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: CreditedPaymentsCheckPorts & {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly markPayments?: ReconciliationMarkPayments;
    }
): Promise<CreditedPaymentsCheckSummary> {
    const failures: CreditedPaymentsCheckFailure[] = [];
    let examined = 0;
    let chargebacks = 0;
    let outOfFlowRefunds = 0;
    let alreadyOpen = 0;
    let since: Date;
    try {
        since = await reconciliationWindowSince({ clock: ports.clock, deadlines: ports.deadlines });
    } catch (error) {
        const message = errorMessage(error);
        logger.error({ error: message }, 'Credited payments check could not read its window');
        return {
            examined,
            chargebacks,
            outOfFlowRefunds,
            alreadyOpen,
            failures: [{ paymentId: null, subscriptionId: null, message }]
        };
    }
    const detection =
        ports.chargebacks ?? createChargebackDetection({ markPayments: ports.markPayments });

    let afterPaymentId: string | undefined;
    for (;;) {
        const page = await reconciliationCreditedPaymentModel.listCreditedPaymentsInWindowPage({
            since,
            afterPaymentId,
            limit: input.pageSize
        });
        for (const payment of page) {
            const subscriptionId = payment.subscriptionId;
            try {
                if (subscriptionId === null) continue;
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readCharge({ chargeId: payment.providerFactId });
                const { snapshot } = assertFreshForAct({ read, act });
                examined++;
                if (snapshot.chargedBack) {
                    chargebacks++;
                    await detection.detect({
                        payment,
                        actor: 'job',
                        correlationId: input.correlationId
                    });
                    continue;
                }
                if (snapshot.refundedAmount.currency !== payment.currency)
                    throw new Error(
                        `Refunded currency ${snapshot.refundedAmount.currency} differs from the payment's ${payment.currency}`
                    );
                const providerRefunded = snapshot.refundedAmount.amountMinor;
                const opened = await getDb().transaction(async (tx) => {
                    const source = { kind: 'PAYMENT' as const, id: payment.id };
                    await lockRefundSource({ tx, source });
                    const claimed = await claimedRefundAmount({ tx, source });
                    if (providerRefunded <= claimed) return false;
                    await openReconciliationMark(
                        {
                            subject: { kind: 'SUBSCRIPTION', subscriptionId },
                            reason: 'REEMBOLSO_FUERA_DEL_FLUJO' satisfies typeof OUT_OF_FLOW_REFUND_REASON,
                            payment: { source: 'PAYMENT', id: payment.id },
                            actor: { type: 'job' },
                            correlationId: input.correlationId,
                            tx
                        },
                        { markPayments: ports.markPayments }
                    );
                    return true;
                });
                if (opened) outOfFlowRefunds++;
            } catch (error) {
                if (error instanceof ServiceError && error.reason === MARK_PAYMENT_ALREADY_HUNG) {
                    alreadyOpen++;
                    continue;
                }
                const message = errorMessage(error);
                failures.push({ paymentId: payment.id, subscriptionId, message });
                logger.error(
                    { paymentId: payment.id, subscriptionId, error: message },
                    'Credited payment check failed'
                );
            }
        }
        if (page.length < input.pageSize) break;
        afterPaymentId = page.at(-1)?.id;
    }
    return { examined, chargebacks, outOfFlowRefunds, alreadyOpen, failures };
}
