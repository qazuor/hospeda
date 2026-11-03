import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    listSuperAdminRecipients
} from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('manual-installment-unpaid-notice');

/** Outbox template for an unpaid manual installment. */
export const MANUAL_INSTALLMENT_UNPAID_TEMPLATE = 'billing.manual-installment-unpaid';

/** Injectable recipient reader for a manual installment notice. */
export interface ManualInstallmentNoticeRecipients {
    list(input?: {
        readonly tx?: DrizzleClient;
    }): Promise<readonly { userId: string; email: string }[]>;
}

/** Enqueues one notice per SUPER_ADMIN in the installment transaction. */
export async function enqueueManualInstallmentUnpaidNotice(
    input: {
        readonly tx: DrizzleClient;
        readonly manualPaymentId: string;
        readonly subscriptionId: string;
        readonly vertical: string;
        readonly periodStart: Date;
        readonly openedAt: Date;
        readonly firstInstallment: boolean;
    },
    ports: { readonly recipients?: ManualInstallmentNoticeRecipients } = {}
): Promise<{ enqueued: number }> {
    const recipients = await (ports.recipients ?? { list: listSuperAdminRecipients }).list({
        tx: input.tx
    });
    if (recipients.length === 0) {
        logger.warn(
            { manualPaymentId: input.manualPaymentId },
            'No SUPER_ADMIN recipients for manual installment notice'
        );
        return { enqueued: 0 };
    }
    for (const recipient of recipients) {
        const template = MANUAL_INSTALLMENT_UNPAID_TEMPLATE;
        await emailOutboxModel.enqueue(
            {
                recipientUserId: recipient.userId,
                recipientEmail: recipient.email,
                template,
                payload: {
                    manualPaymentId: input.manualPaymentId,
                    subscriptionId: input.subscriptionId,
                    vertical: input.vertical,
                    periodStart: input.periodStart.toISOString(),
                    openedAt: input.openedAt.toISOString(),
                    firstInstallment: input.firstInstallment
                },
                dedupKey: buildEmailDedupKey({
                    recipient: recipient.userId,
                    template,
                    occurrence: buildEventOccurrence({ eventId: input.manualPaymentId })
                })
            },
            input.tx
        );
    }
    return { enqueued: recipients.length };
}
