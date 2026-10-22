import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import {
    type ChargebackDetection,
    type ChargebackDetectionResult,
    createChargebackDetection
} from '../reconciliation/chargeback/chargeback-detection';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import type { TouristVipInheritancePort } from '../subscription/cancel-inherited-tourist-vip.service';
import type { CancellationCrossingResult } from '../subscription/cancellation-crossing-charge';
import { settleChargeAcrossCancellation } from '../subscription/cancellation-crossing-charge';
import type { ComplementPolicyPorts } from '../subscription/complement-ports.js';
import type {
    DeclineFirstChargePorts,
    DeclineFirstChargeResult
} from '../subscription/decline-first-charge.service';
import { declineFirstCharge } from '../subscription/decline-first-charge.service';
import type { EnterGraceResult } from '../subscription/enter-grace.service';
import { enterGraceOnRejectedCharge } from '../subscription/enter-grace.service';
import type { ExitGracePorts, ExitGraceResult } from '../subscription/exit-grace.service';
import { exitGraceOnCreditedPayment } from '../subscription/exit-grace.service';
import type { ReactivateSuspendedResult } from '../subscription/reactivate-suspended.service';
import { reactivateSuspendedOnCreditedPayment } from '../subscription/reactivate-suspended.service';
import type { ScheduledChangeApplier } from '../subscription/subscription-billing-ports';
import type { CreditPaymentResult } from './credit-payment.service';
import { creditPayment } from './credit-payment.service';
import type { FailPaymentResult } from './fail-payment.service';
import { failPayment } from './fail-payment.service';
import type { CoverageNotices, PromoChargePolicy, PromoExhaustion } from './payment-ports';
import { isRejectedWithoutRetryWindow } from './rejected-charge-terminal';

const logger = createLogger('record-charge-fact');
const PAYMENT_FACT_CONSTRAINT = 'uq_payment_provider_fact';

export interface RecordChargeFactPorts extends DeclineFirstChargePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
    /** Hangs the payment on reason 7 when S5's or S7's conditions 2 or 3 fail (AC:B7:6, AC:B7:13). */
    readonly markPayments?: ReconciliationMarkPayments;
    /** Who brought the charge, for S5's/S7's reason 7 (I-14): the notice (`provider`, default) or the sweep (`job`). */
    readonly actorType?: ExitGracePorts['actorType'];
    /** Whether the plan S7 restores grants Tourist VIP again (AC:B7:31); unwired skips that clause. */
    readonly touristVipInheritance?: TouristVipInheritancePort;
    /**
     * The internal chargeback interface of AC:B11:27; unwired, the cut's
     * implementation with `markPayments`.
     */
    readonly chargebacks?: ChargebackDetection;
    /** S38's interface, handed to S7 (AC:B7:28); unwired falls back to S7's failing default. */
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    readonly complements?: ComplementPolicyPorts;
}

/** The payment states a read chargeback is handed to the interface from (AC:B11:27). */
const CHARGEBACK_PAYMENT_STATUSES: readonly string[] = [
    'SUCCEEDED',
    'PARTIALLY_REFUNDED',
    'REFUNDED'
];

export type RecordChargeFactResult =
    | { readonly outcome: 'CARD_VALIDATION_IGNORED' }
    | {
          readonly outcome: 'NO_SUBSCRIPTION';
          /**
           * The charge's authorization when it has one we do not link (an unknown
           * preapproval, B11 §2.4), `null` for a charge with no authorization at all.
           * The notice receiver hands a non-null id to `handleUnknownAuthorization`.
           */
          readonly authorizationId: string | null;
      }
    | { readonly outcome: 'RECORDED_PENDING'; readonly paymentId: string }
    | {
          readonly outcome: 'CREDITED';
          readonly paymentId: string;
          readonly credit: CreditPaymentResult;
          /** S5's outcome, present only when the linked row was in GRACE_PERIOD (I-6). */
          readonly exit?: ExitGraceResult;
          /** S7's outcome, present only when the linked row was SUSPENDED (AC:B7:13). */
          readonly reactivation?: ReactivateSuspendedResult;
          /** C2 settlement for a payment whose fact crosses a recorded cancellation. */
          readonly crossing?: CancellationCrossingResult;
      }
    | {
          readonly outcome: 'DECLINED';
          readonly paymentId: string;
          readonly decline: DeclineFirstChargeResult;
          /** P8 (HOS-1734): present only when the rejected charge has no provider retry window. */
          readonly terminalRejection?: FailPaymentResult;
      }
    | {
          readonly outcome: 'GRACE';
          readonly paymentId: string;
          readonly grace: EnterGraceResult;
          /** P8 (HOS-1734): present only when the rejected charge has no provider retry window. */
          readonly terminalRejection?: FailPaymentResult;
      }
    | {
          /** The charge reads charged back on a credited payment: the interface ran (AC:B11:27). */
          readonly outcome: 'CHARGEBACK_DETECTED';
          readonly paymentId: string;
          readonly detection: ChargebackDetectionResult;
      }
    /** Charged back on a payment we never credited: nothing is credited (HOS-1605 H7). */
    | { readonly outcome: 'CHARGEBACK_ON_UNCREDITED'; readonly paymentId: string }
    /**
     * The charge collected and was refunded in full before or after we read it:
     * it credits nothing and runs no S5/S7 (fail closed; a refunded payment used to make the read throw).
     */
    | { readonly outcome: 'REFUNDED_NOT_CREDITED'; readonly paymentId: string };

/** Reads one provider charge by id and records/advances its payment fact. */
export async function recordChargeFact(
    input: { readonly chargeId: string },
    ports: RecordChargeFactPorts
): Promise<RecordChargeFactResult> {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readCharge({ chargeId: input.chargeId });
    const { snapshot: charge } = assertFreshForAct({ read, act });
    if (charge.purpose === 'cardValidation') return { outcome: 'CARD_VALIDATION_IGNORED' };
    if (charge.authorizationId === null)
        return { outcome: 'NO_SUBSCRIPTION', authorizationId: null };

    const [linked] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!linked) return { outcome: 'NO_SUBSCRIPTION', authorizationId: charge.authorizationId };

    let paymentId: string;
    try {
        const inserted = await getDb().transaction(async (tx) =>
            tx.transaction(async (savepoint) => {
                const [row] = await savepoint
                    .insert(payments)
                    .values({
                        subscriptionId: linked.subscription.id,
                        amount: charge.amount.amountMinor,
                        currency: charge.amount.currency,
                        status: 'PENDING',
                        provider: linked.providerLink.provider,
                        providerFactId: input.chargeId,
                        factAt: new Date(charge.createdAt)
                    })
                    .returning({ id: payments.id });
                return row;
            })
        );
        if (!inserted)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Inserted payment fact was not returned',
                undefined,
                'PAYMENT_FACT_INSERT_RETURNING_EMPTY'
            );
        paymentId = inserted.id;
    } catch (error) {
        const cause = extractPostgresErrorCause(error);
        if (cause?.code !== '23505' || cause.constraint !== PAYMENT_FACT_CONSTRAINT) throw error;
        const [existing] = await getDb()
            .select({ id: payments.id })
            .from(payments)
            .where(
                and(
                    eq(payments.provider, linked.providerLink.provider),
                    eq(payments.providerFactId, input.chargeId)
                )
            )
            .limit(1);
        if (!existing)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Payment fact disappeared after duplicate key',
                undefined,
                'PAYMENT_FACT_DUPLICATE_ROW_MISSING'
            );
        paymentId = existing.id;
    }

    if (charge.chargedBack) {
        const [payment] = await getDb()
            .select({
                id: payments.id,
                status: payments.status,
                subscriptionId: payments.subscriptionId
            })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);
        if (payment && CHARGEBACK_PAYMENT_STATUSES.includes(payment.status)) {
            const chargebacks =
                ports.chargebacks ??
                createChargebackDetection({ markPayments: ports.markPayments });
            const detection = await chargebacks.detect({
                payment,
                actor: ports.actorType ?? 'provider',
                correlationId: crypto.randomUUID()
            });
            return { outcome: 'CHARGEBACK_DETECTED', paymentId, detection };
        }
        logger.warn({ paymentId }, 'Chargeback read on a payment we never credited; not crediting');
        return { outcome: 'CHARGEBACK_ON_UNCREDITED', paymentId };
    }
    if (
        charge.status === 'approved' &&
        charge.amount.amountMinor > 0 &&
        charge.refundedAmount.amountMinor >= charge.amount.amountMinor
    ) {
        logger.warn({ paymentId }, 'Charge was refunded in full; it credits nothing');
        return { outcome: 'REFUNDED_NOT_CREDITED', paymentId };
    }

    if (charge.status === 'approved') {
        const credit = await creditPayment(
            { paymentId, chargeCreatedAt: new Date(charge.createdAt) },
            {
                clock: ports.clock,
                promoCharges: ports.promoCharges,
                promoExhaustion: ports.promoExhaustion,
                coverageNotices: ports.coverageNotices
            }
        );
        if (credit.outcome !== 'CREDITED' && credit.outcome !== 'ALREADY_CREDITED')
            return { outcome: 'CREDITED', paymentId, credit };
        let exit: ExitGraceResult | undefined;
        let reactivation: ReactivateSuspendedResult | undefined;
        if (linked.subscription.status === 'GRACE_PERIOD') {
            exit = await exitGraceOnCreditedPayment(
                { paymentId },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    markPayments: ports.markPayments,
                    actorType: ports.actorType
                }
            );
            if (
                !(
                    exit.outcome === 'NOT_APPLICABLE' &&
                    ['NOT_IN_GRACE', 'LOST_RACE'].includes(exit.reason)
                )
            )
                return { outcome: 'CREDITED', paymentId, credit, exit };
        }
        if (linked.subscription.status === 'SUSPENDED') {
            reactivation = await reactivateSuspendedOnCreditedPayment(
                { paymentId },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    markPayments: ports.markPayments,
                    actorType: ports.actorType,
                    coverageNotices: ports.coverageNotices,
                    beforeCancelNotice: ports.beforeCancelNotice,
                    touristVipInheritance: ports.touristVipInheritance,
                    scheduledChangeApplier: ports.scheduledChangeApplier,
                    ...(ports.complements ? { complements: ports.complements } : {})
                }
            );
            if (
                !(
                    reactivation.outcome === 'NOT_APPLICABLE' &&
                    ['NOT_SUSPENDED', 'LOST_RACE'].includes(reactivation.reason)
                )
            )
                return { outcome: 'CREDITED', paymentId, credit, reactivation };
        }
        const crossing = await settleChargeAcrossCancellation(
            { paymentId },
            {
                clock: ports.clock,
                coverageNotices: ports.coverageNotices,
                markPayments: ports.markPayments,
                actorType: ports.actorType
            }
        );
        return {
            outcome: 'CREDITED',
            paymentId,
            credit,
            ...(exit ? { exit } : {}),
            ...(reactivation ? { reactivation } : {}),
            ...(crossing.outcome === 'NOT_APPLICABLE' ? {} : { crossing })
        };
    }
    if (charge.status === 'pending') return { outcome: 'RECORDED_PENDING', paymentId };
    logger.info({ paymentId }, 'Provider charge was rejected');
    const grace = await enterGraceOnRejectedCharge(
        { chargeId: input.chargeId },
        {
            provider: ports.provider,
            clock: ports.clock,
            payments: ports.payments,
            planPolicy: ports.planPolicy
        }
    );
    let result: Extract<RecordChargeFactResult, { readonly outcome: 'GRACE' | 'DECLINED' }>;
    if (grace.outcome !== 'NOT_APPLICABLE') result = { outcome: 'GRACE', paymentId, grace };
    else if (
        grace.reason !== 'NO_CREDITED_PAYMENT' &&
        !(grace.reason === 'NOT_ACTIVE' && linked.subscription.status === 'PENDING_AUTHORIZATION')
    )
        result = { outcome: 'GRACE', paymentId, grace };
    else {
        const decline = await declineFirstCharge({ chargeId: input.chargeId }, ports);
        result = { outcome: 'DECLINED', paymentId, decline };
    }
    if (!isRejectedWithoutRetryWindow({ charge })) return result;
    const terminalRejection = await failPayment({ paymentId }, { clock: ports.clock });
    return { ...result, terminalRejection };
}
