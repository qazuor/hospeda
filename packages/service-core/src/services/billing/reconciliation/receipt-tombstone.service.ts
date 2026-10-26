import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, payments, reconciliationInventoryModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils';
import type { BillingFactSink } from '../facts/billing-fact-sink.js';
import { type CreditPaymentResult, creditPayment } from '../payment/credit-payment.service.js';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger.js';
import type { CoverageNotices } from '../payment/payment-ports.js';
import { lateRejectionDetail } from '../subscription/late-payment-conditions.js';
import { openReconciliationMark } from './open-reconciliation-mark.service.js';
import { recordProviderCancellationDecided } from './provider-cancellation-decision.js';
import type { ReconciliationMarkPayments } from './reconciliation-mark-payments.port.js';

const logger = createLogger('receipt-tombstone');

/** Provider identity of the link and the payment, as start-subscription.service.ts writes it. */
const TOMBSTONE_PROVIDER = 'MERCADO_PAGO' as const;

/** What an unknown authorization's charge turned out to be, read by id. */
export type UnknownChargeReading =
    | { readonly kind: 'NOT_A_CHARGE' }
    | {
          readonly kind: 'CHARGE';
          readonly chargeId: string;
          readonly amountMinor: number;
          readonly currency: string;
          readonly createdAt: Date;
          readonly approved: boolean;
      };

/**
 * Reads the arriving charge by id for the receipt tombstone (I1). A card
 * validation or a rejected attempt is not a charge (RP12, MOT:6): the caller
 * follows the authorization path for it.
 *
 * @param input.authorizationId - The unknown authorization the notice named
 * @param input.chargeId - The charge to read
 * @returns The charge's facts, or `NOT_A_CHARGE`
 * @throws ServiceError `VALIDATION_ERROR` (`CHARGE_AUTHORIZATION_MISMATCH`) when the
 *   charge belongs to another authorization; nothing has been written yet
 */
export async function readUnknownCharge(
    input: { readonly authorizationId: string; readonly chargeId: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<UnknownChargeReading> {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: input.chargeId });
    const { snapshot: charge } = assertFreshForAct({ read, act });
    if (charge.authorizationId !== input.authorizationId)
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            'The charge does not belong to the unknown authorization',
            undefined,
            'CHARGE_AUTHORIZATION_MISMATCH'
        );
    if (charge.purpose === 'cardValidation' || charge.status === 'rejected')
        return { kind: 'NOT_A_CHARGE' };
    return {
        kind: 'CHARGE',
        chargeId: charge.chargeId,
        amountMinor: charge.amount.amountMinor,
        currency: charge.amount.currency,
        createdAt: new Date(charge.createdAt),
        approved: charge.status === 'approved'
    };
}

/** Ports of {@link writeChargeTombstone}. */
export interface WriteChargeTombstonePorts {
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly coverageNotices?: CoverageNotices;
    readonly billingFacts?: BillingFactSink;
}

/** Result of {@link writeChargeTombstone}. */
export type WriteChargeTombstoneResult =
    | { readonly outcome: 'KNOWN'; readonly subscriptionId: string }
    | {
          readonly outcome: 'WRITTEN';
          readonly subscriptionId: string;
          readonly markId: string;
          readonly markOutcome: 'OPENED' | 'ACCUMULATED';
          readonly paymentId: string;
          /** P1's outcome when the charge was approved; `CREDIT_FAILED` when P1 threw after the commit. */
          readonly credit?: CreditPaymentResult | 'CREDIT_FAILED';
      };

/**
 * Writes the receipt tombstone of an unknown authorization's charge
 * (AC:B11:3, AC:B11:5): in ONE transaction the `LAPIDA`/`CANCELLED` row, its
 * provider link, the charge's `PENDING` payment and the `PAGO_TARDIO_RECHAZADO`
 * mark with that payment hung on it (I2). The "refund" proposal is the
 * catalog's, not a column. Once committed, an approved charge is settled by
 * P1 as is: on a `LAPIDA` it writes no `covered_period`, touches no promo,
 * emits no coverage notice and issues its receipt without a recipient. A P1
 * failure undoes nothing already written.
 *
 * Losing the race for `uq_provider_link_provider_id` rolls the whole
 * transaction back and answers `KNOWN` with the winner's row (I7).
 *
 * @param input - The unknown authorization, the charge facts and the correlation id
 * @param ports - Clock, the mark payments port and the coverage notices consumer
 * @returns `WRITTEN` with the tombstone, its mark and payment, or `KNOWN`
 */
export async function writeChargeTombstone(
    input: {
        readonly authorizationId: string;
        readonly charge: Extract<UnknownChargeReading, { kind: 'CHARGE' }>;
        readonly correlationId: string;
        /**
         * When the tombstone is not a probe: the instant the decision to cancel is recorded with
         * (AC:B11:6). Absent for a probe, which had no call and records nothing (AC:B11:4).
         */
        readonly cancellationDecidedAt?: Date;
    },
    ports: WriteChargeTombstonePorts
): Promise<WriteChargeTombstoneResult> {
    const markPayments = ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock);
    let written: Extract<WriteChargeTombstoneResult, { outcome: 'WRITTEN' }>;
    try {
        written = await getDb().transaction(async (tx) => {
            const tombstone = await reconciliationInventoryModel.insertReceiptTombstone({ tx });
            await reconciliationInventoryModel.insertProviderLink({
                subscriptionId: tombstone.id,
                provider: TOMBSTONE_PROVIDER,
                providerId: input.authorizationId,
                tx
            });
            const [payment] = await tx
                .insert(payments)
                .values({
                    subscriptionId: tombstone.id,
                    amount: input.charge.amountMinor,
                    currency: input.charge.currency,
                    status: 'PENDING',
                    provider: TOMBSTONE_PROVIDER,
                    providerFactId: input.charge.chargeId,
                    factAt: input.charge.createdAt
                })
                .returning({ id: payments.id });
            if (!payment)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Inserted tombstone payment was not returned',
                    undefined,
                    'TOMBSTONE_PAYMENT_INSERT_RETURNING_EMPTY'
                );
            const opened = await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: tombstone.id },
                    reason: 'PAGO_TARDIO_RECHAZADO',
                    payment: { source: 'PAYMENT', id: payment.id },
                    actor: { type: 'provider' },
                    correlationId: input.correlationId,
                    detail: lateRejectionDetail({ failedCondition: 1 }),
                    tx
                },
                { markPayments }
            );
            if (input.cancellationDecidedAt) {
                await recordProviderCancellationDecided({
                    subscriptionId: tombstone.id,
                    transition: 'RECEPTION_TOMBSTONE',
                    decidedAt: input.cancellationDecidedAt,
                    actor: { type: 'provider' },
                    correlationId: input.correlationId,
                    changes: [{ field: 'status', new: 'CANCELLED' }],
                    tx
                });
            }
            return {
                outcome: 'WRITTEN' as const,
                subscriptionId: tombstone.id,
                markId: opened.mark.id,
                markOutcome: opened.outcome,
                paymentId: payment.id
            };
        });
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505' || cause.constraint !== 'uq_provider_link_provider_id')
            throw error;
        const winner = await reconciliationInventoryModel.findLinkByProviderId({
            provider: TOMBSTONE_PROVIDER,
            providerId: input.authorizationId
        });
        if (!winner) throw error;
        return { outcome: 'KNOWN', subscriptionId: winner.subscriptionId };
    }

    if (!input.charge.approved) return written;
    try {
        const credit = await creditPayment(
            { paymentId: written.paymentId, chargeCreatedAt: input.charge.createdAt },
            {
                clock: ports.clock,
                coverageNotices: ports.coverageNotices,
                billingFacts: ports.billingFacts
            }
        );
        return { ...written, credit };
    } catch (error) {
        logger.error(
            {
                subscriptionId: written.subscriptionId,
                paymentId: written.paymentId,
                errorName: error instanceof Error ? error.name : typeof error
            },
            'Tombstone payment could not be credited; tombstone, link, payment and mark stay written'
        );
        return { ...written, credit: 'CREDIT_FAILED' };
    }
}
