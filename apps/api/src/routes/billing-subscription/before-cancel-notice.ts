import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    users
} from '@repo/db';
import type { BeforeCancelNotice } from '@repo/service-core';

/** Outbox contract for S1's closure of a declined earlier attempt. */
export const beforeCancelNotice: BeforeCancelNotice = {
    async beforeCancel({ subscriptionId, userId }) {
        const [recipient] = await getDb()
            .select({ email: users.email, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        if (!recipient) return 'NO_RECIPIENT';
        const template = 'billing.before-cancel';
        const dedupKey = buildEmailDedupKey({
            recipient: userId,
            template,
            occurrence: buildEventOccurrence({ eventId: subscriptionId })
        });
        await emailOutboxModel.enqueue({
            recipientUserId: userId,
            recipientEmail: recipient.email,
            template,
            payload: { subscriptionId },
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
