import type { Clock, CoverageChangedEvent } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    coveredPeriods,
    emailOutboxModel,
    eq,
    getDb,
    payments,
    promoRedemptions,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { ServiceError } from '../../../types';
import { extractPostgresErrorCause } from '../../../utils/postgres-error-cause';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import { issueReceipt, readReceiptPayer } from './issue-receipt.js';
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
    readonly beforeOptimisticUpdate?: (input: { readonly paymentId: string }) => Promise<void>;
    readonly onOptimisticUpdateMiss?: (input: { readonly paymentId: string }) => Promise<void>;
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
                await ports.beforeOptimisticUpdate?.({ paymentId: payment.id });
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
                    await ports.onOptimisticUpdateMiss?.({ paymentId: payment.id });
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

                let payerUserId: string | null = null;
                if (payment.addonInstanceId) {
                    const [instance] = await tx
                        .select({ ownerId: addonInstances.ownerId })
                        .from(addonInstances)
                        .where(eq(addonInstances.id, payment.addonInstanceId))
                        .limit(1);
                    payerUserId = instance?.ownerId ?? null;
                } else if (subscription?.class !== 'LAPIDA') {
                    payerUserId = subscription?.userId ?? null;
                }
                const { payer, deliverable } = await readReceiptPayer({ tx, userId: payerUserId });
                const receipt = await issueReceipt({
                    tx,
                    source: { kind: 'PAYMENT', paymentId: payment.id },
                    payer,
                    issuedAt: ports.clock.now()
                });

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
                            chargeCreatedAt: input.chargeCreatedAt,
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
                }
                if (deliverable && payer && payerUserId) {
                    const dedupKey = buildEmailDedupKey({
                        recipient: payerUserId,
                        template: PAYMENT_CREDITED_TEMPLATE,
                        occurrence: buildEventOccurrence({ eventId: payment.id })
                    });
                    const payload = payment.addonInstanceId
                        ? {
                              paymentId: payment.id,
                              addonInstanceId: payment.addonInstanceId,
                              amountMinor: payment.amount,
                              currency: payment.currency,
                              receiptId: receipt.receiptId,
                              receiptNumber: receipt.receiptNumber
                          }
                        : {
                              paymentId: payment.id,
                              subscriptionId: subscription?.id ?? null,
                              amountMinor: payment.amount,
                              currency: payment.currency,
                              receiptId: receipt.receiptId,
                              receiptNumber: receipt.receiptNumber
                          };
                    await emailOutboxModel.enqueue(
                        {
                            recipientUserId: payerUserId,
                            recipientEmail: payer.email,
                            template: PAYMENT_CREDITED_TEMPLATE,
                            payload,
                            dedupKey
                        },
                        tx
                    );
                } else {
                    logger.info(
                        { paymentId: payment.id, receiptId: receipt.receiptId },
                        'Receipt issued without a deliverable payer email'
                    );
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
