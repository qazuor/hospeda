import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    listSuperAdminRecipients
} from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('billing-duplicate-charge-notice');

/** Outbox template for a newly opened duplicate-charge mark. */
export const DUPLICATE_CHARGE_DETECTED_TEMPLATE = 'billing.duplicate-charge-detected';

export interface EnqueueDuplicateChargeNoticeInput {
    readonly tx: DrizzleClient;
    readonly markId: string;
    readonly subject: {
        readonly subjectType: 'subscription' | 'addon_instance';
        readonly subjectId: string;
    };
    readonly openedAt: Date;
    readonly paymentId: string | null;
    readonly correlationId: string;
}

export interface DuplicateChargeNoticeRecipients {
    list(input?: {
        readonly tx?: DrizzleClient;
    }): Promise<readonly { userId: string; email: string }[]>;
}

/** Enqueues the immediate duplicate-charge notice without allowing mail errors to abort S14. */
export async function enqueueDuplicateChargeNotice(
    input: EnqueueDuplicateChargeNoticeInput,
    ports: { readonly recipients?: DuplicateChargeNoticeRecipients } = {}
): Promise<{ enqueued: number }> {
    try {
        return await input.tx.transaction(async (sp) => {
            const recipients = await (ports.recipients ?? { list: listSuperAdminRecipients }).list({
                tx: sp
            });
            if (recipients.length === 0) {
                logger.warn(
                    { markId: input.markId },
                    'No SUPER_ADMIN recipients for duplicate-charge notice'
                );
                return { enqueued: 0 };
            }
            for (const recipient of recipients) {
                const template = DUPLICATE_CHARGE_DETECTED_TEMPLATE;
                const dedupKey = buildEmailDedupKey({
                    recipient: recipient.userId,
                    template,
                    occurrence: buildEventOccurrence({ eventId: input.markId })
                });
                await emailOutboxModel.enqueue(
                    {
                        recipientUserId: recipient.userId,
                        recipientEmail: recipient.email,
                        template,
                        payload: {
                            markId: input.markId,
                            subjectType: input.subject.subjectType,
                            subjectId: input.subject.subjectId,
                            reason: 'COBRO_DUPLICADO',
                            openedAt: input.openedAt.toISOString(),
                            paymentId: input.paymentId
                        },
                        dedupKey,
                        correlationId: input.correlationId
                    },
                    sp
                );
            }
            return { enqueued: recipients.length };
        });
    } catch (error) {
        logger.error({ markId: input.markId, error }, 'Could not enqueue duplicate-charge notice');
        return { enqueued: 0 };
    }
}
