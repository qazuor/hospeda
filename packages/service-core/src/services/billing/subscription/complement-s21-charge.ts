import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient, ReconciliationMarkReason } from '@repo/db';
import { addonProducts, and, coveredPeriods, desc, eq, inArray, isNull, payments } from '@repo/db';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { createPaymentReconciliationMarkPayments } from '../payment/payment-ledger';
import { openReconciliationMark } from '../reconciliation/open-reconciliation-mark.service';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import {
    claimedRefundAmount,
    lockRefundSource,
    REFUNDABLE_PAYMENT_STATUSES
} from '../refund/refund-source';
import { requestRefund } from '../refund/request-refund.service';
import { billingPeriodEnd } from './billing-period-end';
import { revocationWindowEndsAt } from './revocation-payment';

/** Reasons known by the caller of S21; grant revocation is a later transition. */
export const S21_CAUSES = ['OTHER_CAUSE', 'GRANT_REVOKED', 'REVOCATION'] as const;

/** A cause supplied by the transition that made the addon orphaned. */
export type S21Cause = (typeof S21_CAUSES)[number];

/** Catalog reason selected by each cause, exhaustively and without conditional literals. */
export const MARK_REASON_BY_CAUSE: Readonly<Record<S21Cause, ReconciliationMarkReason>> = {
    OTHER_CAUSE: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA',
    GRANT_REVOKED: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_REVOCACION',
    REVOCATION: 'COMPLEMENTO_CON_PERIODO_COBRADO_POR_OTRA_CAUSA'
};

/** Outcome of deciding what to do with the last credited complement charge. */
export type ComplementChargeOutcome =
    | {
          readonly kind: 'NOTHING';
          readonly why: 'NO_CHARGE' | 'NOT_REFUNDABLE' | 'PERIOD_ENDED' | 'BALANCE_CLAIMED';
      }
    | {
          readonly kind: 'REFUND_REQUESTED';
          readonly refundId: string;
          readonly paymentId: string;
          readonly amount: number;
      }
    | {
          readonly kind: 'MARK_OPENED';
          readonly markId: string;
          readonly reason: ReconciliationMarkReason;
          readonly paymentId: string;
          readonly outcome: 'OPENED' | 'ACCUMULATED';
      };

/** Validate the paid period using the shared UTC cycle rules. */
export function complementChargePeriodEnd(input: {
    readonly cycle: keyof typeof BILLING_CYCLE_MONTHS;
    readonly periodStart: Date;
}): Date {
    return billingPeriodEnd({
        periodStart: input.periodStart,
        everyMonths: BILLING_CYCLE_MONTHS[input.cycle]
    }).periodEnd;
}

/** Whether the paid period still includes the decision instant (strict end boundary). */
export function isComplementChargePeriodOpen(input: {
    readonly cycle: keyof typeof BILLING_CYCLE_MONTHS;
    readonly periodStart: Date;
    readonly now: Date;
}): boolean {
    return complementChargePeriodEnd(input) > input.now;
}

/** Decide on an already credited complement charge inside the caller transaction. */
export async function settleComplementLastCharge(
    input: {
        readonly tx: DrizzleClient;
        readonly complementSubscriptionId: string;
        readonly productId: string;
        readonly cause: S21Cause;
        readonly now: Date;
    },
    ports?: { readonly markPayments?: ReconciliationMarkPayments }
): Promise<ComplementChargeOutcome> {
    const [payment] = await input.tx
        .select({
            id: payments.id,
            status: payments.status,
            factAt: payments.factAt,
            amount: payments.amount
        })
        .from(payments)
        .where(
            and(
                eq(payments.subscriptionId, input.complementSubscriptionId),
                inArray(payments.status, [
                    'SUCCEEDED',
                    'PARTIALLY_REFUNDED',
                    'REFUNDED',
                    'CHARGED_BACK'
                ])
            )
        )
        .orderBy(desc(payments.factAt), desc(payments.createdAt), desc(payments.id))
        .limit(1);
    if (!payment) return { kind: 'NOTHING', why: 'NO_CHARGE' };
    if (!REFUNDABLE_PAYMENT_STATUSES.includes(payment.status))
        return { kind: 'NOTHING', why: 'NOT_REFUNDABLE' };

    if (
        input.cause === 'REVOCATION' &&
        input.now < revocationWindowEndsAt({ chargedAt: payment.factAt })
    ) {
        const source = { kind: 'PAYMENT' as const, id: payment.id };
        await lockRefundSource({ tx: input.tx, source });
        const claimed = await claimedRefundAmount({ tx: input.tx, source });
        const amount = payment.amount - claimed;
        if (amount <= 0) return { kind: 'NOTHING', why: 'BALANCE_CLAIMED' };
        const { refundId } = await requestRefund(
            { source, amount, reason: 'ADDON_ORPHAN' },
            { clock: { now: () => input.now } satisfies Clock, tx: input.tx }
        );
        return { kind: 'REFUND_REQUESTED', refundId, paymentId: payment.id, amount };
    }

    const [period] = await input.tx
        .select({ periodStart: coveredPeriods.periodStart })
        .from(coveredPeriods)
        .where(and(eq(coveredPeriods.paymentId, payment.id), isNull(coveredPeriods.releasedAt)))
        .limit(1);
    const periodStart = period?.periodStart ?? payment.factAt;
    const [product] = await input.tx
        .select({ cycle: addonProducts.cycle })
        .from(addonProducts)
        .where(eq(addonProducts.id, input.productId))
        .limit(1);
    if (!product?.cycle || !(product.cycle in BILLING_CYCLE_MONTHS))
        throw new Error(`Complement product ${input.productId} has no valid billing cycle`);
    const cycle = product.cycle as keyof typeof BILLING_CYCLE_MONTHS;
    if (
        !isComplementChargePeriodOpen({
            cycle,
            periodStart,
            now: input.now
        })
    )
        return { kind: 'NOTHING', why: 'PERIOD_ENDED' };

    const reason: ReconciliationMarkReason = MARK_REASON_BY_CAUSE[input.cause];
    const mark = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId: input.complementSubscriptionId },
            reason,
            payment: { source: 'PAYMENT', id: payment.id },
            actor: { type: 'job' },
            correlationId: crypto.randomUUID(),
            tx: input.tx
        },
        {
            markPayments:
                ports?.markPayments ??
                createPaymentReconciliationMarkPayments({ now: () => input.now })
        }
    );
    return {
        kind: 'MARK_OPENED',
        markId: mark.mark.id,
        reason,
        paymentId: payment.id,
        outcome: mark.outcome
    };
}
