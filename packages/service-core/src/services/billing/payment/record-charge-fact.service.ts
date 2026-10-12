import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { and, eq, getDb, payments, providerLinks, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import type {
    DeclineFirstChargePorts,
    DeclineFirstChargeResult
} from '../subscription/decline-first-charge.service';
import { declineFirstCharge } from '../subscription/decline-first-charge.service';
import type { EnterGraceResult } from '../subscription/enter-grace.service';
import { enterGraceOnRejectedCharge } from '../subscription/enter-grace.service';
import type { ExitGracePorts, ExitGraceResult } from '../subscription/exit-grace.service';
import { exitGraceOnCreditedPayment } from '../subscription/exit-grace.service';
import type { CreditPaymentResult } from './credit-payment.service';
import { creditPayment } from './credit-payment.service';
import type { CoverageNotices, PromoChargePolicy, PromoExhaustion } from './payment-ports';

const logger = createLogger('record-charge-fact');
const PAYMENT_FACT_CONSTRAINT = 'uq_payment_provider_fact';

export interface RecordChargeFactPorts extends DeclineFirstChargePorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly planPolicy?: VerticalsForBilling['planPolicy'];
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
    /** Hangs the payment on reason 7 when S5's conditions 2 or 3 fail (AC:B7:6). */
    readonly markPayments?: ReconciliationMarkPayments;
    /** Who brought the charge, for S5's reason 7 (I-14): the notice (`provider`, default) or the sweep (`job`). */
    readonly actorType?: ExitGracePorts['actorType'];
}

export type RecordChargeFactResult =
    | { readonly outcome: 'CARD_VALIDATION_IGNORED' }
    | { readonly outcome: 'NO_SUBSCRIPTION' }
    | { readonly outcome: 'RECORDED_PENDING'; readonly paymentId: string }
    | {
          readonly outcome: 'CREDITED';
          readonly paymentId: string;
          readonly credit: CreditPaymentResult;
          /** S5's outcome, present only when the linked row was in GRACE_PERIOD (I-6). */
          readonly exit?: ExitGraceResult;
      }
    | {
          readonly outcome: 'DECLINED';
          readonly paymentId: string;
          readonly decline: DeclineFirstChargeResult;
      }
    | { readonly outcome: 'GRACE'; readonly paymentId: string; readonly grace: EnterGraceResult };

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
    if (charge.authorizationId === null) return { outcome: 'NO_SUBSCRIPTION' };

    const [linked] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(providerLinks)
        .innerJoin(subscriptions, eq(subscriptions.id, providerLinks.subscriptionId))
        .where(eq(providerLinks.providerId, charge.authorizationId))
        .limit(1);
    if (!linked) return { outcome: 'NO_SUBSCRIPTION' };

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
        if (
            (credit.outcome === 'CREDITED' || credit.outcome === 'ALREADY_CREDITED') &&
            linked.subscription.status === 'GRACE_PERIOD'
        ) {
            const exit = await exitGraceOnCreditedPayment(
                { paymentId },
                {
                    provider: ports.provider,
                    clock: ports.clock,
                    markPayments: ports.markPayments,
                    actorType: ports.actorType
                }
            );
            return { outcome: 'CREDITED', paymentId, credit, exit };
        }
        return { outcome: 'CREDITED', paymentId, credit };
    }
    if (charge.status === 'pending') return { outcome: 'RECORDED_PENDING', paymentId };
    logger.info({ paymentId }, 'Provider charge was rejected; payment fact remains pending');
    const grace = await enterGraceOnRejectedCharge(
        { chargeId: input.chargeId },
        {
            provider: ports.provider,
            clock: ports.clock,
            payments: ports.payments,
            planPolicy: ports.planPolicy
        }
    );
    if (grace.outcome !== 'NOT_APPLICABLE' || grace.reason !== 'NO_CREDITED_PAYMENT')
        return { outcome: 'GRACE', paymentId, grace };
    const decline = await declineFirstCharge({ chargeId: input.chargeId }, ports);
    return { outcome: 'DECLINED', paymentId, decline };
}
