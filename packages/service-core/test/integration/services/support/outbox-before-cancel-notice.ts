import {
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    emailOutboxModel,
    eq,
    users
} from '@repo/db';
import type {
    BeforeCancelNotice,
    BeforeCancelNoticeStatus
} from '../../../../src/services/billing/subscription/start-subscription.service.js';
import { getServiceTestDb } from '../helpers.js';

type BeforeCancelKind = NonNullable<Parameters<BeforeCancelNotice['beforeCancel']>[0]['kind']>;

const TEMPLATE_BY_KIND: Readonly<Record<BeforeCancelKind | 'DEFAULT', string>> = {
    DEFAULT: 'billing.before-cancel',
    TOURIST_VIP_INHERITED: 'billing.tourist-vip-inherited-cancel',
    ARREARS_SUSPENSION: 'billing.arrears-suspension'
};

/**
 * A database-backed `BeforeCancelNotice`: mirror of the API adapter
 * (`apps/api/src/routes/billing-subscription/before-cancel-notice.ts`); keep in
 * sync. It enqueues the same template, dedup key and payload (with the notice
 * `content`), and reads the same outbox row for the status. With `deliver`, the
 * enqueued row is marked `sent` first, as the outbox sender would; with
 * `failWith`, it is marked `failed` with that `last_error` (an undeliverable
 * address or a definitive failure after the retries).
 *
 * @param input.deliver - Whether the enqueued row is delivered before its status is read
 * @param input.failWith - The `last_error` of a row the sender gave up on before its status is read
 * @returns The notice port
 */
export function outboxBeforeCancelNotice(
    input: { readonly deliver?: boolean; readonly failWith?: string } = {}
): BeforeCancelNotice {
    return {
        async beforeCancel({
            subscriptionId,
            userId,
            kind,
            occurrenceId,
            content
        }): Promise<BeforeCancelNoticeStatus> {
            const db = getServiceTestDb();
            const [recipient] = await db
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
            if (input.deliver)
                await db
                    .update(emailOutbox)
                    .set({ status: 'sent' })
                    .where(eq(emailOutbox.dedupKey, dedupKey));
            if (input.failWith)
                await db
                    .update(emailOutbox)
                    .set({ status: 'failed', lastError: input.failWith })
                    .where(eq(emailOutbox.dedupKey, dedupKey));
            if (recipient.deletedAt) return 'NO_RECIPIENT';
            const [row] = await db
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
}
