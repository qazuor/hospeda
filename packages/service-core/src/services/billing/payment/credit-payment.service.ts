import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    coveredPeriods,
    emailOutboxModel,
    eq,
    getDb,
    payments,
    promoRedemptions,
    subscriptions,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import {
    createPaymentReconciliationMarkPayments,
    creditedPaymentsFromLedger
} from './payment-ledger';
import type { CoverageNotices, PromoChargePolicy, PromoExhaustion } from './payment-ports';
import {
    unregisteredPromoChargePolicy,
    unregisteredPromoExhaustion,
    unwiredCoverageNotices
} from './payment-ports';

const logger = createLogger('credit-payment');
const PAYMENT_CREDITED_TEMPLATE = 'billing.payment-credited';
const COVERAGE_DUPLICATE_CONSTRAINT = 'uq_covered_period_open_subscription_period';

export interface CreditPaymentPorts {
    readonly clock: Clock;
    readonly promoCharges?: PromoChargePolicy;
    readonly promoExhaustion?: PromoExhaustion;
    readonly coverageNotices?: CoverageNotices;
    readonly markPayments?: import('../reconciliation/reconciliation-mark-payments.port').ReconciliationMarkPayments;
}

export interface CreditPaymentResult {
    readonly outcome: 'CREDITED' | 'ALREADY_CREDITED' | 'NOT_PENDING';
    readonly coverage: 'WRITTEN' | 'DUPLICATE_MARKED' | 'NOT_APPLICABLE';
}

interface PostCommitEffects {
    readonly coverageEvent?: CoverageChangedEvent;
    readonly exhaustedPromos: readonly {
        readonly subscriptionId: string;
        readonly redemptionId: string;
    }[];
}

/** P1: optimistically credits a pending payment and commits its ledger effects atomically. */
export async function creditPayment(
    input: { readonly paymentId: string; readonly chargeCreatedAt: Date },
    ports: CreditPaymentPorts
): Promise<CreditPaymentResult> {
    const effects = await getDb().transaction(
        async (tx): Promise<{ result: CreditPaymentResult; after: PostCommitEffects }> => {
            for (let attempt = 0; attempt < 3; attempt++) {
                const [payment] = await tx
                    .select()
                    .from(payments)
                    .where(eq(payments.id, input.paymentId))
                    .limit(1);
                if (!payment)
                    throw new ServiceError(
                        ServiceErrorCode.NOT_FOUND,
                        'Payment not found',
                        undefined,
                        'PAYMENT_NOT_FOUND'
                    );
                if (payment.status === 'SUCCEEDED')
                    return {
                        result: { outcome: 'ALREADY_CREDITED', coverage: 'NOT_APPLICABLE' },
                        after: { exhaustedPromos: [] }
                    };
                if (payment.status !== 'PENDING')
                    return {
                        result: { outcome: 'NOT_PENDING', coverage: 'NOT_APPLICABLE' },
                        after: { exhaustedPromos: [] }
                    };

                const subscription = payment.subscriptionId
                    ? (
                          await tx
                              .select()
                              .from(subscriptions)
                              .where(eq(subscriptions.id, payment.subscriptionId))
                              .limit(1)
                      )[0]
                    : undefined;
                const firstPayment =
                    subscription?.class === 'PRINCIPAL'
                        ? !(await creditedPaymentsFromLedger.hasCreditedPayment({
                              subscriptionId: subscription.id,
                              tx
                          }))
                        : false;
                const [credited] = await tx
                    .update(payments)
                    .set({
                        status: 'SUCCEEDED',
                        version: payment.version + 1,
                        updatedAt: ports.clock.now()
                    })
                    .where(
                        and(
                            eq(payments.id, payment.id),
                            eq(payments.status, 'PENDING'),
                            eq(payments.version, payment.version)
                        )
                    )
                    .returning();
                if (!credited) {
                    const [latest] = await tx
                        .select({ status: payments.status })
                        .from(payments)
                        .where(eq(payments.id, payment.id))
                        .limit(1);
                    if (latest?.status === 'SUCCEEDED')
                        return {
                            result: { outcome: 'ALREADY_CREDITED', coverage: 'NOT_APPLICABLE' },
                            after: { exhaustedPromos: [] }
                        };
                    continue;
                }

                let coverage: CreditPaymentResult['coverage'] = 'NOT_APPLICABLE';
                const exhaustedPromos: { subscriptionId: string; redemptionId: string }[] = [];
                if (subscription && subscription.class !== 'LAPIDA') {
                    try {
                        await tx.transaction(async (savepoint) => {
                            await savepoint.insert(coveredPeriods).values({
                                subscriptionId: subscription.id,
                                periodStart: input.chargeCreatedAt,
                                paymentId: payment.id,
                                creditedAt: ports.clock.now()
                            });
                        });
                        coverage = 'WRITTEN';
                    } catch (error) {
                        const cause = extractPostgresErrorCause(error);
                        if (
                            cause?.code !== '23505' ||
                            cause.constraint !== COVERAGE_DUPLICATE_CONSTRAINT
                        )
                            throw error;
                        await openReconciliationMark(
                            {
                                subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.id },
                                reason: 'COBRO_DUPLICADO',
                                payment: { source: 'PAYMENT', id: payment.id },
                                actor: { type: 'provider' },
                                correlationId: payment.id,
                                tx
                            },
                            {
                                markPayments:
                                    ports.markPayments ??
                                    createPaymentReconciliationMarkPayments(ports.clock)
                            }
                        );
                        coverage = 'DUPLICATE_MARKED';
                    }

                    const redemptions = await tx
                        .select({
                            id: promoRedemptions.id,
                            remainingCharges: promoRedemptions.remainingCharges
                        })
                        .from(promoRedemptions)
                        .where(
                            and(
                                eq(promoRedemptions.subscriptionId, subscription.id),
                                sql`${promoRedemptions.remainingCharges} > 0`
                            )
                        );
                    for (const redemption of redemptions) {
                        const discounted = await (
                            ports.promoCharges ?? unregisteredPromoChargePolicy
                        ).chargedWithDiscount({
                            subscriptionId: subscription.id,
                            redemptionId: redemption.id,
                            amountMinor: payment.amount,
                            currency: payment.currency,
                            tx
                        });
                        if (!discounted) continue;
                        const [remaining] = await tx
                            .update(promoRedemptions)
                            .set({
                                remainingCharges: sql`${promoRedemptions.remainingCharges} - 1`
                            })
                            .where(
                                and(
                                    eq(promoRedemptions.id, redemption.id),
                                    sql`${promoRedemptions.remainingCharges} > 0`
                                )
                            )
                            .returning({ remainingCharges: promoRedemptions.remainingCharges });
                        if (remaining?.remainingCharges === 0)
                            exhaustedPromos.push({
                                subscriptionId: subscription.id,
                                redemptionId: redemption.id
                            });
                    }

                    const user = subscription.userId
                        ? (
                              await tx
                                  .select({ email: users.email })
                                  .from(users)
                                  .where(eq(users.id, subscription.userId))
                                  .limit(1)
                          )[0]
                        : undefined;
                    if (!subscription.userId || !user?.email) {
                        logger.warn(
                            { subscriptionId: subscription.id },
                            'No user email for credited payment'
                        );
                    } else {
                        const dedupKey = buildEmailDedupKey({
                            recipient: subscription.userId,
                            template: PAYMENT_CREDITED_TEMPLATE,
                            occurrence: buildEventOccurrence({ eventId: payment.id })
                        });
                        await emailOutboxModel.enqueue(
                            {
                                recipientUserId: subscription.userId,
                                recipientEmail: user.email,
                                template: PAYMENT_CREDITED_TEMPLATE,
                                payload: {
                                    paymentId: payment.id,
                                    subscriptionId: subscription.id,
                                    amountMinor: payment.amount,
                                    currency: payment.currency
                                },
                                dedupKey
                            },
                            tx
                        );
                    }
                }
                const vertical = subscription?.vertical
                    ? VerticalEnumSchema.safeParse(subscription.vertical)
                    : undefined;
                const coverageEvent =
                    firstPayment &&
                    subscription?.class === 'PRINCIPAL' &&
                    subscription.userId &&
                    vertical?.success
                        ? {
                              userId: subscription.userId,
                              vertical: vertical.data,
                              sourceType: 'SUBSCRIPTION' as const,
                              change: 'CHANGED' as const
                          }
                        : undefined;
                return {
                    result: { outcome: 'CREDITED', coverage },
                    after: { coverageEvent, exhaustedPromos }
                };
            }
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Payment credit lost repeated optimistic races',
                undefined,
                'PAYMENT_CREDIT_RACE_EXHAUSTED'
            );
        }
    );

    if (effects.after.coverageEvent) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged(
                effects.after.coverageEvent
            );
        } catch (error) {
            logger.error(
                { paymentId: input.paymentId, error },
                'Coverage changed notice failed after payment commit'
            );
        }
    }
    for (const promo of effects.after.exhaustedPromos) {
        try {
            await (ports.promoExhaustion ?? unregisteredPromoExhaustion).runS30(promo);
        } catch (error) {
            logger.error({ ...promo, error }, 'S30 failed after payment commit');
        }
    }
    return effects.result;
}
