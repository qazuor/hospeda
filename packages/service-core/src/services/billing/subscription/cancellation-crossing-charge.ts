import type { Clock } from '@repo/billing-verticals-contract';
import {
    addonInstances,
    addonProducts,
    and,
    coveredPeriods,
    eq,
    getDb,
    isNull,
    payments,
    reconciliationInventoryModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import type { CoverageNotices } from '../payment/payment-ports';
import { unwiredCoverageNotices } from '../payment/payment-ports';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import {
    classifyCancellationCrossing,
    crossingExtensionEnd,
    crossingMarkDetail
} from './cancellation-crossing-rule';
import { complementChargePeriodEnd } from './complement-s21-charge';
import { isLiveSuccessionPredecessor } from './late-payment-conditions';
import { computeS11ServiceEnd, readS11ServiceEndFacts } from './s11-service-end';

/** Ports for the C2 cancellation-crossing settlement. */
export interface CancellationCrossingPorts {
    readonly clock: Clock;
    readonly coverageNotices?: CoverageNotices;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly actorType?: 'provider' | 'job';
}
/** Result of extending, marking, or declining to act on one credited payment. */
export type CancellationCrossingResult =
    | {
          readonly outcome: 'EXTENDED';
          readonly subscriptionId: string;
          readonly previousServiceEndsAt: Date;
          readonly serviceEndsAt: Date;
      }
    | {
          readonly outcome: 'NOT_EXTENDED';
          readonly subscriptionId: string;
          readonly serviceEndsAt: Date;
      }
    | {
          readonly outcome: 'MARKED';
          readonly subscriptionId: string;
          readonly markId: string;
          readonly markOutcome: 'OPENED' | 'ACCUMULATED';
          readonly transition: 'S11' | 'S23' | 'S24';
      }
    | { readonly outcome: 'ALREADY_MARKED'; readonly subscriptionId: string }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason:
              | 'PAYMENT_NOT_CREDITED'
              | 'NO_SUBSCRIPTION'
              | 'OUT_OF_SCOPE'
              | 'LIVE_SUCCESSION_PREDECESSOR'
              | 'NO_COVERED_PERIOD';
      };

const inputSchema = z.strictObject({ paymentId: z.uuid() });
const MARK_PAYMENT_ALREADY_HUNG = 'MARK_PAYMENT_ALREADY_HUNG';

/**
 * C2 settles charges that cross cancellation. The fact date decides the two rows:
 * an earlier S11 payment extends service with max; a later payment, or any S23/S24
 * payment, is hung on a human reconciliation mark. B5.9 and Coord-8 also call this
 * exported rule for action 14. No automatic refund is requested.
 */
export async function settleChargeAcrossCancellation(
    input: { readonly paymentId: string },
    ports: CancellationCrossingPorts
): Promise<CancellationCrossingResult> {
    const value = inputSchema.parse(input);
    let coverageNotice:
        | { readonly userId: string; readonly vertical: z.infer<typeof VerticalEnumSchema> }
        | undefined;
    const result = await getDb().transaction(async (tx): Promise<CancellationCrossingResult> => {
        const [payment] = await tx
            .select()
            .from(payments)
            .where(eq(payments.id, value.paymentId))
            .limit(1);
        if (!payment || !['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(payment.status))
            return { outcome: 'NOT_APPLICABLE', reason: 'PAYMENT_NOT_CREDITED' };
        if (!payment.subscriptionId)
            return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
        const [subscription] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, payment.subscriptionId))
            .limit(1)
            .for('update');
        if (!subscription) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
        if (await isLiveSuccessionPredecessor({ subscriptionId: subscription.id, tx }))
            return { outcome: 'NOT_APPLICABLE', reason: 'LIVE_SUCCESSION_PREDECESSOR' };
        const decision = await reconciliationInventoryModel.findCancellationDecision({
            subscriptionId: subscription.id,
            tx
        });
        const action = classifyCancellationCrossing({
            status: subscription.status,
            class: subscription.class,
            decision,
            factAt: payment.factAt
        });
        if (action === 'NONE') {
            logger.info(
                { paymentId: payment.id, subscriptionId: subscription.id },
                'Charge is outside cancellation crossing scope'
            );
            return { outcome: 'NOT_APPLICABLE', reason: 'OUT_OF_SCOPE' };
        }
        if (action === 'EXTEND') {
            if (!decision) return { outcome: 'NOT_APPLICABLE', reason: 'OUT_OF_SCOPE' };
            const [period] = await tx
                .select()
                .from(coveredPeriods)
                .where(
                    and(eq(coveredPeriods.paymentId, payment.id), isNull(coveredPeriods.releasedAt))
                )
                .limit(1);
            if (!period) return { outcome: 'NOT_APPLICABLE', reason: 'NO_COVERED_PERIOD' };
            let formula: Date;
            if (subscription.class === 'PRINCIPAL') {
                const facts = await readS11ServiceEndFacts({ tx, subscription });
                formula = computeS11ServiceEnd({
                    now: decision.decidedAt,
                    paidPeriodStart: period.periodStart,
                    everyMonths: facts.everyMonths,
                    creditEndsAt: facts.creditEndsAt
                }).serviceEndsAt;
            } else if (subscription.class === 'COMPLEMENTO') {
                const [instance] = await tx
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.complementSubscriptionId, subscription.id))
                    .limit(1);
                const [product] = instance
                    ? await tx
                          .select()
                          .from(addonProducts)
                          .where(eq(addonProducts.id, instance.productId))
                          .limit(1)
                    : [];
                if (
                    !product?.cycle ||
                    !['monthly', 'quarterly', 'semiannual', 'annual'].includes(product.cycle)
                )
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Complement product has no valid billing cycle',
                        undefined,
                        'CROSSING_COMPLEMENT_CYCLE_INVALID'
                    );
                formula = complementChargePeriodEnd({
                    cycle: product.cycle as 'monthly' | 'quarterly' | 'semiannual' | 'annual',
                    periodStart: period.periodStart
                });
            } else return { outcome: 'NOT_APPLICABLE', reason: 'OUT_OF_SCOPE' };
            if (!subscription.serviceEndsAt)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Scheduled cancellation has no service end',
                    undefined,
                    'CROSSING_EXTENSION_SERVICE_END_MISSING'
                );
            const end = crossingExtensionEnd({ current: subscription.serviceEndsAt, formula });
            if (!end.extended)
                return {
                    outcome: 'NOT_EXTENDED',
                    subscriptionId: subscription.id,
                    serviceEndsAt: subscription.serviceEndsAt
                };
            const writers: Record<
                'PRINCIPAL' | 'COMPLEMENTO',
                (serviceEndsAt: Date) => Promise<void>
            > = {
                PRINCIPAL: (serviceEndsAt) =>
                    writeCrossingExtensionOnPrincipal({
                        tx,
                        id: subscription.id,
                        serviceEndsAt,
                        now: ports.clock.now()
                    }),
                COMPLEMENTO: (serviceEndsAt) =>
                    writeCrossingExtensionOnComplement({
                        tx,
                        id: subscription.id,
                        serviceEndsAt,
                        now: ports.clock.now()
                    })
            };
            await writers[subscription.class as 'PRINCIPAL' | 'COMPLEMENTO'](end.serviceEndsAt);
            if (subscription.class === 'PRINCIPAL' && subscription.userId) {
                const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
                if (vertical.success)
                    coverageNotice = { userId: subscription.userId, vertical: vertical.data };
            }
            return {
                outcome: 'EXTENDED',
                subscriptionId: subscription.id,
                previousServiceEndsAt: subscription.serviceEndsAt,
                serviceEndsAt: end.serviceEndsAt
            };
        }
        if (!decision) return { outcome: 'NOT_APPLICABLE', reason: 'OUT_OF_SCOPE' };
        const transition = decision.transition as 'S11' | 'S23' | 'S24';
        const alreadyHung = await tx
            .select({ id: reconciliationMarkPayments.id })
            .from(reconciliationMarkPayments)
            .innerJoin(
                reconciliationMarks,
                eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
            )
            .where(
                and(
                    eq(reconciliationMarkPayments.paymentId, payment.id),
                    eq(reconciliationMarks.subscriptionId, subscription.id),
                    eq(reconciliationMarks.reason, 'COBRO_POSTERIOR_A_LA_BAJA')
                )
            )
            .limit(1);
        if (alreadyHung.length)
            return { outcome: 'ALREADY_MARKED', subscriptionId: subscription.id };
        try {
            const opened = await openReconciliationMark(
                {
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: subscription.id },
                    reason: 'COBRO_POSTERIOR_A_LA_BAJA',
                    payment: { source: 'PAYMENT', id: payment.id },
                    actor: { type: ports.actorType ?? 'provider' },
                    correlationId: crypto.randomUUID(),
                    detail: crossingMarkDetail({
                        chargeId: payment.providerFactId,
                        amountMinor: payment.amount,
                        currency: payment.currency,
                        factAt: payment.factAt,
                        transition,
                        graceStartedAt: subscription.graceStartedAt
                    }),
                    tx
                },
                {
                    markPayments:
                        ports.markPayments ?? createPaymentReconciliationMarkPayments(ports.clock)
                }
            );
            return {
                outcome: 'MARKED',
                subscriptionId: subscription.id,
                markId: opened.mark.id,
                markOutcome: opened.outcome,
                transition
            };
        } catch (error) {
            if (error instanceof ServiceError && error.reason === MARK_PAYMENT_ALREADY_HUNG)
                return { outcome: 'ALREADY_MARKED', subscriptionId: subscription.id };
            throw error;
        }
    });
    if (result.outcome === 'EXTENDED' && coverageNotice) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                ...coverageNotice,
                sourceType: 'SUBSCRIPTION',
                change: 'CHANGED'
            });
        } catch (error) {
            logger.error(
                { error, subscriptionId: result.subscriptionId },
                'Failed to emit crossing coverage change'
            );
        }
    }
    return result;
}

const logger = createLogger('cancellation-crossing-charge');

async function writeCrossingExtensionOnPrincipal(input: {
    tx: import('@repo/db').DrizzleClient;
    id: string;
    serviceEndsAt: Date;
    now: Date;
}): Promise<void> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({ serviceEndsAt: input.serviceEndsAt, updatedAt: input.now })
        .where(
            and(
                eq(subscriptions.id, input.id),
                eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                eq(subscriptions.class, 'PRINCIPAL')
            )
        )
        .returning({ id: subscriptions.id });
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Subscription changed during cancellation extension',
            undefined,
            'CROSSING_EXTENSION_STATE_CHANGED'
        );
}
async function writeCrossingExtensionOnComplement(input: {
    tx: import('@repo/db').DrizzleClient;
    id: string;
    serviceEndsAt: Date;
    now: Date;
}): Promise<void> {
    const [row] = await input.tx
        .update(subscriptions)
        .set({ serviceEndsAt: input.serviceEndsAt, updatedAt: input.now })
        .where(
            and(
                eq(subscriptions.id, input.id),
                eq(subscriptions.status, 'CANCEL_SCHEDULED'),
                eq(subscriptions.class, 'COMPLEMENTO')
            )
        )
        .returning({ id: subscriptions.id });
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Subscription changed during cancellation extension',
            undefined,
            'CROSSING_EXTENSION_STATE_CHANGED'
        );
}
