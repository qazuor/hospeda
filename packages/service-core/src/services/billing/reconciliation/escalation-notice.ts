import type { DrizzleClient } from '@repo/db';
import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutboxModel,
    listSuperAdminRecipients
} from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('billing-mark-escalated-notice');

/** Outbox template for a reconciliation mark that has escalated. */
export const MARK_ESCALATED_TEMPLATE = 'billing.mark-escalated';

export interface EnqueueMarkEscalatedNoticeInput {
    readonly tx: DrizzleClient;
    readonly markId: string;
    readonly subject: {
        readonly subjectType: 'subscription' | 'addon_instance';
        readonly subjectId: string;
    };
    readonly reason: string;
    readonly placedAt: Date;
    readonly escalatedAt: Date;
    readonly escalationDays: number;
    readonly correlationId: string;
}

export interface MarkEscalatedNoticeRecipients {
    list(input?: {
        readonly tx?: DrizzleClient;
    }): Promise<readonly { userId: string; email: string }[]>;
}

/** Enqueues one immediate escalation notice per active SUPER_ADMIN. */
export async function enqueueMarkEscalatedNotice(
    input: EnqueueMarkEscalatedNoticeInput,
    ports: { readonly recipients?: MarkEscalatedNoticeRecipients } = {}
): Promise<{ enqueued: number }> {
    const recipients = await (ports.recipients ?? { list: listSuperAdminRecipients }).list({
        tx: input.tx
    });
    if (recipients.length === 0) {
        logger.warn(
            { markId: input.markId },
            'No SUPER_ADMIN recipients for escalated mark notice'
        );
        return { enqueued: 0 };
    }
    for (const recipient of recipients) {
        const template = MARK_ESCALATED_TEMPLATE;
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
                    reason: input.reason,
                    placedAt: input.placedAt.toISOString(),
                    escalatedAt: input.escalatedAt.toISOString(),
                    escalationDays: input.escalationDays
                },
                dedupKey,
                correlationId: input.correlationId
            },
            input.tx
        );
    }
    return { enqueued: recipients.length };
}
