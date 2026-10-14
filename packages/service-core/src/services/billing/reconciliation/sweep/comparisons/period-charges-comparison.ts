import {
    and,
    coveredPeriods,
    eq,
    getDb,
    gte,
    isNull,
    payments,
    reconciliationInventoryModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    SUBSCRIPTION_STATUSES,
    subscriptionPauses
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { actStartInstant, assertFreshForAct } from '@repo/payments';
import {
    evaluateLatePaymentConditions,
    hasOtherLivePrincipal,
    isLiveSuccessionPredecessor
} from '../../../subscription/late-payment-conditions.js';
import type { ReconciliationComparison } from '../reconciliation-divergence.js';
import { readListedCharges } from './listed-charges.js';
import { reasonForUnregisteredCharge } from './unregistered-charge-reason.js';

async function findPayment(input: { readonly provider: string; readonly chargeId: string }) {
    const [payment] = await getDb()
        .select()
        .from(payments)
        .where(
            and(eq(payments.provider, input.provider), eq(payments.providerFactId, input.chargeId))
        )
        .limit(1);
    return payment ?? null;
}

async function alreadyHung(input: { readonly paymentId: string }) {
    const [row] = await getDb()
        .select({ id: reconciliationMarkPayments.id })
        .from(reconciliationMarkPayments)
        .innerJoin(
            reconciliationMarks,
            eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
        )
        .where(
            and(
                eq(reconciliationMarkPayments.paymentId, input.paymentId),
                isNull(reconciliationMarkPayments.resolvedAt),
                isNull(reconciliationMarks.liftedAt)
            )
        )
        .limit(1);
    return Boolean(row);
}

async function openPauseStartsAt(input: { readonly subscriptionId: string }) {
    const [pause] = await getDb()
        .select({ startsAt: subscriptionPauses.startsAt })
        .from(subscriptionPauses)
        .where(
            and(
                eq(subscriptionPauses.subscriptionId, input.subscriptionId),
                isNull(subscriptionPauses.actualEndAt)
            )
        )
        .limit(1);
    return pause?.startsAt ?? null;
}

async function paymentCoversUnpaidPeriod(input: {
    readonly subscriptionId: string;
    readonly graceStartedAt: Date | null;
}) {
    if (!input.graceStartedAt) return false;
    const [period] = await getDb()
        .select({ id: coveredPeriods.id })
        .from(coveredPeriods)
        .where(
            and(
                eq(coveredPeriods.subscriptionId, input.subscriptionId),
                isNull(coveredPeriods.releasedAt),
                // The H5.7 condition is a period credited at or after grace began.
                gte(coveredPeriods.creditedAt, input.graceStartedAt)
            )
        )
        .limit(1);
    return !period;
}

/**
 * AC:B11:10 (H3, H5–H8, H18): finds approved, unreversed listed charges absent
 * from the credited ledger. This comparison only opens S14 marks and never
 * writes a payment or covered period.
 */
export function createPeriodChargesComparison(ports: {
    readonly provider: PaymentProvider;
}): ReconciliationComparison {
    return async ({ subscription, providerLink, read, act }) => {
        const status = SUBSCRIPTION_STATUSES.find((item) => item === subscription.status);
        if (!status) return [];
        const actStart = actStartInstant({ act }).at.getTime();
        if (
            subscription.status === 'GRACE_PERIOD' &&
            subscription.graceEndsAt !== null &&
            subscription.graceEndsAt.getTime() <= actStart
        )
            return [];
        const { snapshot: authorization } = assertFreshForAct({ read, act });
        if (
            (subscription.status === 'ACTIVE' || subscription.status === 'GRACE_PERIOD') &&
            authorization.status === 'paused'
        )
            return [];

        const listed = await readListedCharges({ authorizationRead: read, act }, ports);
        const divergences = [];
        for (const chargeRead of listed.charges) {
            const { snapshot: charge } = assertFreshForAct({ read: chargeRead, act });
            if (charge.purpose !== 'charge' || charge.status !== 'approved') continue;
            const amountMinor = charge.amount.amountMinor;
            if (
                charge.chargedBack ||
                (amountMinor > 0 && charge.refundedAmount.amountMinor >= amountMinor)
            )
                continue;

            const payment = await findPayment({
                provider: providerLink.provider,
                chargeId: charge.chargeId
            });
            if (
                payment &&
                ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CHARGED_BACK'].includes(
                    payment.status
                )
            )
                continue;
            if (payment && (await alreadyHung({ paymentId: payment.id }))) continue;

            const cancellationDecision = [
                'CANCELLED',
                'ABANDONED',
                'CHARGE_DECLINED',
                'CANCEL_SCHEDULED'
            ].includes(subscription.status)
                ? await reconciliationInventoryModel.findCancellationDecision({
                      subscriptionId: subscription.id
                  })
                : null;
            const pauseStartsAt =
                subscription.status === 'PAUSED'
                    ? await openPauseStartsAt({ subscriptionId: subscription.id })
                    : null;
            const predecessor = await isLiveSuccessionPredecessor({
                subscriptionId: subscription.id
            });
            let latePaymentVerdict = null;
            if (subscription.status === 'GRACE_PERIOD' || subscription.status === 'SUSPENDED') {
                const otherPrincipal = await hasOtherLivePrincipal({ subscription });
                const coversUnpaid = await paymentCoversUnpaidPeriod({
                    subscriptionId: subscription.id,
                    graceStartedAt: subscription.graceStartedAt
                });
                latePaymentVerdict = evaluateLatePaymentConditions({
                    facts: {
                        status: subscription.status,
                        admittedStatuses: [subscription.status],
                        succeededById: subscription.succeededById,
                        isPredecessorInSuccession: predecessor,
                        hasOtherLivePrincipal: otherPrincipal,
                        paymentAmount: { amountMinor, currency: charge.amount.currency },
                        authorizationAmount: {
                            amountMinor: authorization.amount.amountMinor,
                            currency: authorization.amount.currency
                        },
                        paymentCoversUnpaidPeriod: coversUnpaid
                    }
                });
            }
            const reason = reasonForUnregisteredCharge({
                facts: {
                    class: subscription.class,
                    status,
                    isLiveSuccessionPredecessor: predecessor,
                    cancellationDecision,
                    openPauseStartsAt: pauseStartsAt,
                    chargeCreatedAt: new Date(charge.createdAt),
                    latePaymentVerdict
                }
            });
            divergences.push({
                reason,
                ...(payment ? { payment: { source: 'PAYMENT' as const, id: payment.id } } : {}),
                detail: [
                    { field: 'provider.charge_id', new: charge.chargeId },
                    { field: 'provider.charge_amount_minor', new: amountMinor }
                ]
            });
        }
        return divergences;
    };
}
