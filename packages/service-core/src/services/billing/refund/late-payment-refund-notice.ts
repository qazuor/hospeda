import type { DrizzleClient } from '@repo/db';
import {
    addonInstances,
    addons,
    addonVersions,
    and,
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    eq,
    isNotNull,
    partnerApplicationModel,
    payments,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import { heldByPageChargeMark } from '../addon/one-time-page-charge-marks';

const logger = createLogger('late-payment-refund-notice');

/** Outbox template mailed to the buyer when a late one-time payment is refunded (HOS-2179 P-3, D3). */
export const LATE_PAYMENT_REFUNDED_TEMPLATE = 'billing.late-payment-refunded';

/** The only mark whose refund mails the buyer: money on a purchase that had already closed (MOT:23). */
const LATE_PAYMENT_MARK_REASON = 'ORDEN_PAGADA_SIN_INSTANCIA';

/** Why no mail was enqueued, or `ENQUEUED` / `ALREADY_ENQUEUED`. */
export type LatePaymentRefundNoticeOutcome =
    | 'ENQUEUED'
    | 'ALREADY_ENQUEUED'
    | 'NOT_A_LATE_PAYMENT'
    | 'REFUND_NOT_EXECUTED'
    | 'NO_RECIPIENT';

const inputSchema = z.strictObject({
    tx: z.custom<DrizzleClient>((value) => typeof value === 'object' && value !== null),
    refundId: z.string().uuid(),
    paymentId: z.string().uuid()
});

/** Pure payload of the buyer mail. */
export function buildLatePaymentRefundedPayload(input: {
    readonly refundId: string;
    readonly paymentId: string;
    readonly addonInstanceId: string;
    readonly locale: 'es' | 'en' | 'pt';
    readonly addonSlug: string;
    readonly addonName: string;
    readonly amountMinor: number;
    readonly currency: string;
}): {
    refundId: string;
    paymentId: string;
    addonInstanceId: string;
    locale: 'es' | 'en' | 'pt';
    addonSlug: string;
    addonName: string;
    amountMinor: number;
    currency: string;
} {
    return {
        refundId: input.refundId,
        paymentId: input.paymentId,
        addonInstanceId: input.addonInstanceId,
        locale: input.locale,
        addonSlug: input.addonSlug,
        addonName: input.addonName,
        amountMinor: input.amountMinor,
        currency: input.currency
    };
}

/**
 * D3 of HOS-2179 (owner, 2026-11-20; spec P-3): when the refund of a payment that a mark 23
 * holds EXECUTES, the buyer is told their payment arrived after the purchase had closed and
 * that the amount was refunded. Runs inside the caller's settlement transaction, so the mail
 * commits only with the `EXECUTED` refund.
 *
 * - Only a payment hung (resolved or not) from an add-on instance's `ORDEN_PAGADA_SIN_INSTANCIA`
 *   mark mails; the refund of a `DIVERGENCIA_DE_MONTO` or `COBRO_DUPLICADO` charge does not.
 * - The recipient is the purchasing account, the add-on instance's owner, never the payer's
 *   declared email (MP never returns `payer_email`).
 * - The amount is the executed refund's, in the payment's currency.
 * - The dedup key is `(owner, template, refund id)`: re-running the settlement never mails twice.
 *
 * @param input.tx - The settlement transaction
 * @param input.refundId - The refund that just executed
 * @param input.paymentId - The refunded payment
 * @returns What happened; a missing recipient is logged and skipped, never thrown
 */
export async function enqueueLatePaymentRefundNotice(input: {
    readonly tx: DrizzleClient;
    readonly refundId: string;
    readonly paymentId: string;
}): Promise<{ readonly outcome: LatePaymentRefundNoticeOutcome }> {
    const { tx, refundId, paymentId } = inputSchema.parse(input);
    const [held] = await tx
        .select({ markId: reconciliationMarks.id })
        .from(reconciliationMarkPayments)
        .innerJoin(
            reconciliationMarks,
            eq(reconciliationMarks.id, reconciliationMarkPayments.markId)
        )
        .where(
            and(
                eq(reconciliationMarkPayments.paymentId, paymentId),
                eq(reconciliationMarks.reason, LATE_PAYMENT_MARK_REASON),
                isNotNull(reconciliationMarks.addonInstanceId)
            )
        )
        .limit(1);
    if (!held) return { outcome: 'NOT_A_LATE_PAYMENT' };

    const [row] = await tx
        .select({
            refundStatus: refunds.status,
            amountMinor: refunds.amount,
            currency: payments.currency,
            addonInstanceId: addonInstances.id,
            ownerId: addonInstances.ownerId,
            addonSlug: addons.slug,
            addonName: addons.name,
            email: users.email
        })
        .from(refunds)
        .innerJoin(payments, eq(payments.id, refunds.paymentId))
        .innerJoin(addonInstances, eq(addonInstances.id, payments.addonInstanceId))
        .innerJoin(addonVersions, eq(addonVersions.id, addonInstances.addonVersionId))
        .innerJoin(addons, eq(addons.id, addonVersions.addonId))
        .innerJoin(users, eq(users.id, addonInstances.ownerId))
        // GUARD:HELD-ROWS: this reads the instance of a HELD row on purpose (the late charge mark
        // 23 holds), never the purchase's own payment.
        .where(
            and(eq(refunds.id, refundId), eq(refunds.paymentId, paymentId), heldByPageChargeMark())
        )
        .limit(1);
    if (!row) return { outcome: 'NOT_A_LATE_PAYMENT' };
    if (row.refundStatus !== 'EXECUTED') return { outcome: 'REFUND_NOT_EXECUTED' };
    if (!row.email) {
        logger.warn(
            { refundId, addonInstanceId: row.addonInstanceId },
            'No account email for the late payment refund notice'
        );
        return { outcome: 'NO_RECIPIENT' };
    }
    const locale = await partnerApplicationModel.readAccountLocaleByEmail({
        tx,
        email: row.email
    });
    const template = LATE_PAYMENT_REFUNDED_TEMPLATE;
    const result = await emailOutboxModel.enqueue(
        {
            recipientUserId: row.ownerId,
            recipientEmail: row.email,
            template,
            payload: buildLatePaymentRefundedPayload({
                refundId,
                paymentId,
                addonInstanceId: row.addonInstanceId,
                locale,
                addonSlug: row.addonSlug,
                addonName: row.addonName,
                amountMinor: row.amountMinor,
                currency: row.currency
            }),
            dedupKey: buildEmailDedupKey({
                recipient: row.ownerId,
                template,
                occurrence: buildEventOccurrence({ eventId: refundId })
            })
        },
        tx
    );
    return { outcome: result.enqueued ? 'ENQUEUED' : 'ALREADY_ENQUEUED' };
}
