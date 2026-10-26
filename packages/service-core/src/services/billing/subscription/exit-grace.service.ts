import type { Clock } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import type { BillingFactSink } from '../facts/billing-fact-sink';
import { emitBillingFact } from '../facts/billing-fact-sink';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import {
    checkLatePaymentConditions,
    isLiveSuccessionPredecessor,
    type LatePaymentFailedCondition,
    lateRejectionDetail
} from './late-payment-conditions';
import { releaseRetainedPayment, retainPaymentForSuccession } from './succession-retained-payment';

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
    readonly billingFacts?: BillingFactSink;
}

/**
 * The single write of S5: `GRACE_PERIOD → ACTIVE` with the grace clock turned off.
 * The `status` guard makes a concurrent transition lose instead of overwriting it.
 *
 * When `paymentId` is given (S5 deciding a credited payment), that payment's open
 * S19 retention, if any, is closed with `REEVALUATED` in the same transaction as
 * the write (branch 2, HOS-1561 H9). Callers that omit it see no change.
 *
 * @param input.subscriptionId - The row leaving grace
 * @param input.now - The write instant
 * @param input.paymentId - Optional: the payment whose destination this write decides
 * @returns True when this call moved the row; false when it was no longer in grace
 */
export async function reactivateFromGrace(input: {
    readonly subscriptionId: string;
    readonly now: Date;
    readonly paymentId?: string;
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
        if (updated && input.paymentId)
            await releaseRetainedPayment({
                paymentId: input.paymentId,
                reason: 'REEVALUATED',
                now: input.now,
                tx
            });
        return Boolean(updated);
    });
}

/**
 * S19 from S5 (AC:B7:16, HOS-1561 H4): in a transaction of its own, rereads and
 * locks the row, confirms it is still in `GRACE_PERIOD` and still the predecessor
 * of a live succession, and only then records the payment as pending with
 * `grace_started_at` as the anchor of the unpaid period. Nothing else is written:
 * no mark, no notice, no refund, no `domain_event` (H14).
 *
 * @param input.subscriptionId - The predecessor in grace
 * @param input.paymentId - The credited payment of the unpaid period
 * @param input.now - The instant of the act
 * @returns False when the reread no longer confirms the row (nothing written)
 */
async function retainForSuccession(input: {
    readonly subscriptionId: string;
    readonly paymentId: string;
    readonly now: Date;
}): Promise<boolean> {
    const retained = await getDb().transaction(async (tx) => {
        const [locked] = await tx
            .select({ status: subscriptions.status, graceStartedAt: subscriptions.graceStartedAt })
            .from(subscriptions)
            .where(eq(subscriptions.id, input.subscriptionId))
            .limit(1)
            .for('update');
        if (locked?.status !== 'GRACE_PERIOD') return null;
        if (!(await isLiveSuccessionPredecessor({ subscriptionId: input.subscriptionId, tx })))
            return null;
        const unpaidSince = locked.graceStartedAt ?? input.now;
        const retention = await retainPaymentForSuccession({
            subscriptionId: input.subscriptionId,
            payment: { source: 'PAYMENT', id: input.paymentId },
            unpaidSince,
            now: input.now,
            tx
        });
        return {
            unpaidSince,
            anchorMissing: locked.graceStartedAt === null,
            alreadyRetained: retention.outcome === 'ALREADY_RETAINED'
        };
    });
    if (!retained) return false;
    if (retained.anchorMissing)
        logger.warn(
            { subscriptionId: input.subscriptionId, paymentId: input.paymentId },
            'S19 retained a payment on a GRACE_PERIOD row without grace_started_at; the act instant is the anchor'
        );
    logger.info(
        {
            subscriptionId: input.subscriptionId,
            paymentId: input.paymentId,
            unpaidSince: retained.unpaidSince,
            alreadyRetained: retained.alreadyRetained
        },
        'S19 retained the unpaid-period payment of a succession predecessor'
    );
    return true;
}

/**
 * S5 (AC:B7:6): a credited payment returns a `GRACE_PERIOD` card principal to
 * `ACTIVE` when the four conditions of `05` §3 hold, and turns the grace clock off.
 *
 * The payment must already be credited by P1 (I-5: separate transactions, P1
 * first). The predecessor of a succession in progress is left to S19 without a
 * mark (D-4), which records the payment as pending (HOS-1561 H4; `LOST_RACE` when
 * the locked reread no longer confirms grace and succession); a duplicate of an already paid period is P1's `COBRO_DUPLICADO`
 * (D-3); conditions 2 and 3 open reason 7 `PAGO_TARDIO_RECHAZADO` (I-3).
 * The payment must cover THE period whose charge failed (condition 4 bound to the
 * grace's `grace_started_at`, see `paymentCoversUnpaidPeriod`): a replayed notice of
 * an earlier, already credited payment (`ALREADY_CREDITED`) never leaves grace.
 * When S5 decides the payment's destination (`REACTIVATED` or `CONDITION_FAILED`)
 * it closes that payment's open S19 retention with `REEVALUATED` (branch 2, S3's
 * re-evaluation, HOS-1561 H9); `RETAINED_FOR_S19` and `NOT_APPLICABLE` leave it.
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

    if ('retainedForS19' in verdict) {
        const retained = await retainForSuccession({
            subscriptionId: subscription.id,
            paymentId: payment.id,
            now: ports.clock.now()
        });
        if (!retained) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
        return { outcome: 'RETAINED_FOR_S19', subscriptionId: subscription.id };
    }
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
                    correlationId: payment.id,
                    detail: lateRejectionDetail({ failedCondition })
                },
                {
                    markPayments:
                        ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock)
                }
            );
        }
        // Branch 2 (HOS-1561 H9): the payment's destination is decided, so its S19 flag
        // (if any) is turned off. After the mark, so a failed mark leaves it up.
        await getDb().transaction(async (tx) => {
            await releaseRetainedPayment({
                paymentId: payment.id,
                reason: 'REEVALUATED',
                now: ports.clock.now(),
                tx
            });
        });
        return { outcome: 'CONDITION_FAILED', subscriptionId: subscription.id, failedCondition };
    }

    const reactivatedAt = ports.clock.now();
    const reactivated = await reactivateFromGrace({
        subscriptionId: subscription.id,
        now: reactivatedAt,
        paymentId: payment.id
    });
    if (!reactivated) return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE' };
    const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
    if (subscription.userId && vertical.success)
        emitBillingFact({
            sink: ports.billingFacts,
            fact: {
                kind: 'RECOVERED',
                userId: subscription.userId,
                vertical: vertical.data,
                subscriptionId: subscription.id,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                occurredAt: reactivatedAt,
                recoveredFrom: 'GRACE_PERIOD',
                paymentId: payment.id
            }
        });
    logger.info(
        { subscriptionId: subscription.id, paymentId: payment.id },
        'Subscription left grace after a credited payment'
    );
    return { outcome: 'REACTIVATED', subscriptionId: subscription.id };
}
