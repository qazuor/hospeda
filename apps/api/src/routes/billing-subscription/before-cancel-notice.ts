import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    users
} from '@repo/db';
import { BEFORE_CANCEL_TEMPLATE_BY_KIND, type BeforeCancelNotice } from '@repo/service-core';

/**
 * Outbox contract for the notice that precedes every cancellation we execute.
 * The template comes from the mandatory `kind`, through service-core's
 * `BEFORE_CANCEL_TEMPLATE_BY_KIND`: there is no default notice (HOS-1683). The occurrence is the fact that decided the cancellation (`occurrenceId`,
 * defaulting to the subscription id), so a retry reads the row already enqueued.
 * The arrears suspension carries its `content` (AC:B7:30) into the payload.
 */
export const beforeCancelNotice: BeforeCancelNotice = {
    async beforeCancel({ subscriptionId, userId, kind, occurrenceId, content }) {
        const [recipient] = await getDb()
            .select({ email: users.email, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!recipient) return 'NO_RECIPIENT';
        const template = BEFORE_CANCEL_TEMPLATE_BY_KIND[kind];
        const dedupKey = buildEmailDedupKey({
            recipient: userId,
            template,
            occurrence: buildEventOccurrence({ eventId: occurrenceId ?? subscriptionId })
        });
        await emailOutboxModel.enqueue({
            recipientUserId: userId,
            recipientEmail: recipient.email,
            template,
            payload: { subscriptionId, ...(content ?? {}) },
            dedupKey
        });
        if (recipient.deletedAt) return 'NO_RECIPIENT';
        const [row] = await getDb()
            .select({ status: emailOutbox.status, lastError: emailOutbox.lastError })
            .from(emailOutbox)
            .where(eq(emailOutbox.dedupKey, dedupKey))
            .limit(1);
        if (row?.status === 'sent') return 'SENT';
        if (row?.status === 'failed') {
            return row.lastError === 'undeliverable:hard_bounce' ||
                row.lastError === 'suppressed:account_deleted'
                ? 'NO_RECIPIENT'
                : 'DELIVERY_EXHAUSTED';
        }
        return 'NOT_YET_SENT';
    }
};
