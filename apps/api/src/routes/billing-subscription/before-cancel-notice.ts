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

type BeforeCancelKind = NonNullable<Parameters<BeforeCancelNotice['beforeCancel']>[0]['kind']>;

/** The outbox template of each before-cancel kind (X-1: S6 has its own arrears template). */
const TEMPLATE_BY_KIND: Readonly<Record<BeforeCancelKind | 'DEFAULT', string>> = {
    DEFAULT: 'billing.before-cancel',
    TOURIST_VIP_INHERITED: 'billing.tourist-vip-inherited-cancel',
    ARREARS_SUSPENSION: 'billing.arrears-suspension',
    ADDON_CANCELLED: 'billing.addon-cancelled'
};

/**
 * Outbox contract for the notice that precedes every cancellation we execute.
 * The occurrence is the fact that decided the cancellation (`occurrenceId`,
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
        const template = TEMPLATE_BY_KIND[kind ?? 'DEFAULT'];
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
