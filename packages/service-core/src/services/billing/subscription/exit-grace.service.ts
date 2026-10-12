import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, type PaymentProvider } from '@repo/payments';
import { z } from 'zod';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import {
    checkLatePaymentConditions,
    type LatePaymentFailedCondition
} from './late-payment-conditions';

const logger = createLogger('exit-grace');
const inputSchema = z.strictObject({ paymentId: z.uuid() });
const S5_ADMITTED_STATUSES = ['GRACE_PERIOD'] as const;

/** Outcomes of applying S5 to a credited payment. */
export type ExitGraceResult =
    | { readonly outcome: 'REACTIVATED'; readonly subscriptionId: string }
    | { readonly outcome: 'RETAINED_FOR_S19'; readonly subscriptionId: string }
    | {
          readonly outcome: 'CONDITION_FAILED';
          readonly subscriptionId: string;
          readonly failedCondition: LatePaymentFailedCondition;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'PAYMENT_NOT_CREDITED'
              | 'NO_SUBSCRIPTION'
              | 'NOT_IN_GRACE'
              | 'NOT_CARD_PRINCIPAL'
              | 'LOST_RACE';
      };

/** Ports needed by S5; `actorType` names who brought the payment (notice or sweep). */
export interface ExitGracePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly actorType?: 'provider' | 'job';
}

/**
 * The single write of S5: `GRACE_PERIOD → ACTIVE` with the grace clock turned off.
 * The `status` guard makes a concurrent transition lose instead of overwriting it.
 *
 * @param input.subscriptionId - The row leaving grace
 * @param input.now - The write instant
 * @returns True when this call moved the row; false when it was no longer in grace
 */
export async function reactivateFromGrace(input: {
    readonly subscriptionId: string;
    readonly now: Date;
}): Promise<boolean> {
    return getDb().transaction(async (tx) => {
        const [updated] = await tx
            .update(subscriptions)
            .set({
                status: 'ACTIVE',
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: input.now
            })
            .where(
                and(
                    eq(subscriptions.id, input.subscriptionId),
                    eq(subscriptions.status, 'GRACE_PERIOD')
                )
            )
            .returning({ id: subscriptions.id });
        return Boolean(updated);
    });
}

/**
 * S5 (AC:B7:6): a credited payment returns a `GRACE_PERIOD` card principal to
 * `ACTIVE` when the four conditions of `05` §3 hold, and turns the grace clock off.
 *
 * The payment must already be credited by P1 (I-5: separate transactions, P1
 * first). The predecessor of a succession in progress is left to S19 without a
 * mark (D-4); a duplicate of an already paid period is P1's `COBRO_DUPLICADO`
 * (D-3); conditions 2 and 3 open reason 7 `PAGO_TARDIO_RECHAZADO` (I-3).
 * The payment must cover THE period whose charge failed (condition 4 bound to the
 * grace's `grace_started_at`, see `paymentCoversUnpaidPeriod`): a replayed notice of
 * an earlier, already credited payment (`ALREADY_CREDITED`) never leaves grace.
 *
 * @param input.paymentId - The credited payment
 * @param ports - Provider, clock, mark payment port and actor type
 * @returns The S5 outcome
 */
export async function exitGraceOnCreditedPayment(
    input: { readonly paymentId: string },
    ports: ExitGracePorts
): Promise<ExitGraceResult> {
    const value = inputSchema.parse(input);
    const [payment] = await getDb()
        .select()
        .from(payments)
        .where(eq(payments.id, value.paymentId))
        .limit(1);
    if (payment?.status !== 'SUCCEEDED')
        return { outcome: 'NOT_APPLICABLE', reason: 'PAYMENT_NOT_CREDITED' };
    if (!payment.subscriptionId) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, payment.subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    if (subscription.status !== 'GRACE_PERIOD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_IN_GRACE' };
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL' };

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const authorizationRead = await ports.provider.readAuthorization({
        authorizationId: providerLink.providerId
    });
    const verdict = await checkLatePaymentConditions({
        subscription,
        payment: {
            id: payment.id,
            amount: { amountMinor: payment.amount, currency: payment.currency }
        },
        authorizationRead,
        act,
        admittedStatuses: S5_ADMITTED_STATUSES,
        unpaidSince: subscription.graceStartedAt
    });

    if ('retainedForS19' in verdict)
        return { outcome: 'RETAINED_FOR_S19', subscriptionId: subscription.id };
    if (!verdict.ok) {
        const { failedCondition } = verdict;
        logger.warn(
            { subscriptionId: subscription.id, paymentId: payment.id, failedCondition },
            'Late payment cannot reactivate the subscription'
        );
        // Condition 4 (a duplicate or an already paid period) is P1's COBRO_DUPLICADO, not reason 7 (D-3).
        if (failedCondition === 2 || failedCondition === 3) {
            await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.id },
                    reason: 'PAGO_TARDIO_RECHAZADO',
                    payment: { source: 'PAYMENT', id: payment.id },
                    actor: { type: ports.actorType ?? 'provider' },
                    correlationId: payment.id
                },
                {
                    markPayments:
                        ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock)
                }
            );
        }
        return { outcome: 'CONDITION_FAILED', subscriptionId: subscription.id, failedCondition };
    }

    const reactivated = await reactivateFromGrace({
        subscriptionId: subscription.id,
        now: ports.clock.now()
    });
    if (!reactivated) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
    logger.info(
        { subscriptionId: subscription.id, paymentId: payment.id },
        'Subscription left grace after a credited payment'
    );
    return { outcome: 'REACTIVATED', subscriptionId: subscription.id };
}
