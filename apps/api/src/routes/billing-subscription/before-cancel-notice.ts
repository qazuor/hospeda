import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    getDb,
    sql,
    subscriptions,
    users
} from '@repo/db';
import {
    BEFORE_CANCEL_TEMPLATE_BY_KIND,
    type BeforeCancelNotice,
    type BeforeCancelNoticeKind,
    type BeforeCancelNoticeStatusReader
} from '@repo/service-core';

const SCHEDULED_CANCELLATION_KIND = 'SCHEDULED_CANCELLATION' satisfies BeforeCancelNoticeKind;

function beforeCancelDedupKey(input: {
    subscriptionId: string;
    userId: string;
    kind: BeforeCancelNoticeKind;
    occurrenceId?: string;
}): string {
    return buildEmailDedupKey({
        recipient: input.userId,
        template: BEFORE_CANCEL_TEMPLATE_BY_KIND[input.kind],
        occurrence: buildEventOccurrence({ eventId: input.occurrenceId ?? input.subscriptionId })
    });
}

/** Reads the existing before-cancel outbox row with the database clock, without enqueueing. */
export const beforeCancelNoticeStatus: BeforeCancelNoticeStatusReader = {
    async read({ subscriptionId, userId, kind }) {
        const [row] = await getDb()
            .select({
                status: emailOutbox.status,
                ageMs: sql<number>`extract(epoch from (now() - ${emailOutbox.updatedAt})) * 1000`
            })
            .from(emailOutbox)
            .where(eq(emailOutbox.dedupKey, beforeCancelDedupKey({ subscriptionId, userId, kind })))
            .limit(1);
        if (!row) return { state: 'ABSENT', settledAgeMs: null };
        const settledAgeMs = Math.max(0, Math.round(Number(row.ageMs)));
        if (row.status === 'sent') return { state: 'SENT', settledAgeMs };
        if (row.status === 'failed') return { state: 'UNDELIVERABLE', settledAgeMs };
        return { state: 'PENDING', settledAgeMs };
    }
};

/**
 * Outbox contract for the notice that precedes every cancellation we execute.
 * The template comes from the mandatory `kind`, through service-core's
 * `BEFORE_CANCEL_TEMPLATE_BY_KIND`: there is no default notice (HOS-1683). The occurrence is the fact that decided the cancellation (`occurrenceId`,
 * defaulting to the subscription id), so a retry reads the row already enqueued.
 * The arrears suspension carries its `content` (AC:B7:30) into the payload. Scheduled
 * cancellation also carries the committed service end date for its notice (HOS-1617).
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
        const dedupKey = beforeCancelDedupKey({ subscriptionId, userId, kind, occurrenceId });
        const scheduledServiceEnd =
            kind === SCHEDULED_CANCELLATION_KIND
                ? await getDb()
                      .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                      .from(subscriptions)
                      .where(eq(subscriptions.id, subscriptionId))
                      .limit(1)
                : null;
        const serviceEndsAt = scheduledServiceEnd?.[0]?.serviceEndsAt?.toISOString() ?? null;
        await emailOutboxModel.enqueue({
            recipientUserId: userId,
            recipientEmail: recipient.email,
            template,
            payload: {
                subscriptionId,
                ...(kind === SCHEDULED_CANCELLATION_KIND ? { serviceEndsAt } : {}),
                ...(content ?? {})
            },
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
