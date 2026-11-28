/**
 * @file webhooks/brevo-direct-email.ts
 *
 * Brevo webhook events of the admin direct emails (HOS-2685, AC-9). The recipient row of
 * a direct email is matched by provider message id and moves to `delivered`, `opened` or
 * `bounced`; a hard bounce also suppresses the address. Message ids that are not direct
 * emails (newsletter, transactional) are ignored here.
 *
 * Kept out of `brevo.ts` so that handler stays under the file-size limit.
 */

import { apiLogger } from '../../utils/logger';
import { getDirectEmailMessageService } from '../direct-email/_singletons';

/** Brevo event name to the event the direct email service understands. */
const DIRECT_EMAIL_EVENTS = {
    delivered: 'delivered',
    opened: 'opened',
    unique_opened: 'opened',
    hard_bounce: 'hard_bounce',
    soft_bounce: 'soft_bounce'
} as const;

/** Outcome of {@link recordDirectEmailEvent}. */
export type DirectEmailWebhookOutcome = 'matched' | 'ignored' | 'write_failed';

/**
 * Applies one Brevo event to the direct email recipient with that message id.
 * Idempotent. Never throws: a failed write is reported so the caller can answer 503 and
 * let Brevo redeliver.
 *
 * @param input.eventType - Brevo `event` field
 * @param input.messageId - Brevo `message-id` of the event
 * @param input.at - Event time
 * @returns `matched` when a direct email recipient was found, `ignored` for events or
 *   message ids that are not ours, `write_failed` when the write threw
 */
export async function recordDirectEmailEvent(input: {
    readonly eventType: string;
    readonly messageId: string | undefined;
    readonly at: Date;
}): Promise<DirectEmailWebhookOutcome> {
    const event = DIRECT_EMAIL_EVENTS[input.eventType as keyof typeof DIRECT_EMAIL_EVENTS];
    if (!event || !input.messageId) return 'ignored';
    try {
        const { matched } = await getDirectEmailMessageService().applyProviderEvent({
            providerMessageId: input.messageId,
            event,
            at: input.at
        });
        return matched ? 'matched' : 'ignored';
    } catch (err) {
        apiLogger.error(
            { error: err instanceof Error ? err.message : String(err), event },
            'Brevo webhook: failed to apply a direct email event, asking Brevo to redeliver'
        );
        return 'write_failed';
    }
}
