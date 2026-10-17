/** RF5 (B6, AC:B6:6) calls this interface in its transaction after writing FAILED; this module does not write RF5. */
import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    listSuperAdminRecipients,
    manualPayments,
    payments,
    refunds
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { ServiceError } from '../../../types';
import type { Rf1Reason } from '../refund/refund-machine.js';

const logger = createLogger('billing-revocation-refund-failed-notice');

export const REVOCATION_REFUND_FAILED_TEMPLATE = 'billing.revocation-refund-failed';
export const REVOCATION_REFUND_REASONS = [
    'REVOCATION',
    'ADDON_ORPHAN',
    'ONE_TIME_ADDON_REVOCATION'
] as const satisfies readonly Rf1Reason[];

export interface RevocationRefundFailedNoticeRecipients {
    list(input?: {
        readonly tx?: DrizzleClient;
    }): Promise<readonly { userId: string; email: string }[]>;
}

/** Enqueues the failed revocation refund notice inside a savepoint of RF5's transaction. */
export async function enqueueRevocationRefundFailedNotice(
    input: {
        readonly tx: DrizzleClient;
        readonly refundId: string;
        readonly failedAt: Date;
        readonly correlationId: string;
    },
    ports: { readonly recipients?: RevocationRefundFailedNoticeRecipients } = {}
): Promise<{
    readonly enqueued: number;
    readonly skipped: 'NOT_FAILED' | 'NOT_REVOCATION' | 'NO_RECIPIENTS' | 'ENQUEUE_FAILED' | null;
}> {
    const [row] = await input.tx
        .select({
            refundId: refunds.id,
            reason: refunds.reason,
            status: refunds.status,
            amountMinor: refunds.amount,
            paymentId: refunds.paymentId,
            manualPaymentId: refunds.manualPaymentId,
            paymentCurrency: payments.currency,
            paymentSubscriptionId: payments.subscriptionId,
            paymentAddonInstanceId: payments.addonInstanceId,
            manualSubscriptionId: manualPayments.subscriptionId
        })
        .from(refunds)
        .leftJoin(payments, eq(refunds.paymentId, payments.id))
        .leftJoin(manualPayments, eq(refunds.manualPaymentId, manualPayments.id))
        .where(eq(refunds.id, input.refundId))
        .limit(1);
    if (!row)
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            'Refund not found',
            undefined,
            'REFUND_NOT_FOUND'
        );
    if (row.status !== 'FAILED') return { enqueued: 0, skipped: 'NOT_FAILED' };
    if (!(REVOCATION_REFUND_REASONS as readonly string[]).includes(row.reason))
        return { enqueued: 0, skipped: 'NOT_REVOCATION' };

    const sourceKind = row.paymentId ? 'payment' : 'manual_payment';
    const sourceId = row.paymentId ?? row.manualPaymentId;
    const subjectType = row.paymentId
        ? row.paymentSubscriptionId
            ? 'subscription'
            : row.paymentAddonInstanceId
              ? 'addon_instance'
              : null
        : row.manualSubscriptionId
          ? 'subscription'
          : null;
    const subjectId = row.paymentId
        ? (row.paymentSubscriptionId ?? row.paymentAddonInstanceId)
        : row.manualSubscriptionId;
    const payload = {
        refundId: row.refundId,
        refundReason: row.reason,
        sourceKind,
        sourceId,
        subjectType,
        subjectId,
        amountMinor: row.amountMinor,
        currency: row.paymentId ? row.paymentCurrency : null,
        failedAt: input.failedAt.toISOString()
    };

    try {
        return await input.tx.transaction(async (sp) => {
            const recipients = await (ports.recipients ?? { list: listSuperAdminRecipients }).list({
                tx: sp
            });
            if (recipients.length === 0) {
                logger.warn(
                    { refundId: row.refundId },
                    'No SUPER_ADMIN recipients for revocation refund failure notice'
                );
                return { enqueued: 0, skipped: 'NO_RECIPIENTS' as const };
            }
            for (const recipient of recipients) {
                const template = REVOCATION_REFUND_FAILED_TEMPLATE;
                await emailOutboxModel.enqueue(
                    {
                        recipientUserId: recipient.userId,
                        recipientEmail: recipient.email,
                        template,
                        payload,
                        dedupKey: buildEmailDedupKey({
                            recipient: recipient.userId,
                            template,
                            occurrence: buildEventOccurrence({ eventId: row.refundId })
                        }),
                        correlationId: input.correlationId
                    },
                    sp
                );
            }
            return { enqueued: recipients.length, skipped: null };
        });
    } catch (error) {
        logger.error(
            { refundId: row.refundId, error },
            'Could not enqueue revocation refund failure notice'
        );
        return { enqueued: 0, skipped: 'ENQUEUE_FAILED' };
    }
}
