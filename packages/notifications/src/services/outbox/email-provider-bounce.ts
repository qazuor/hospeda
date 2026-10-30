/**
 * Asynchronous hard bounces reported by the email provider (HOS-1627, AC:U2:12).
 *
 * A provider can accept a mail and report afterwards, through its webhook,
 * that the address hard-bounced. This module turns that report into the
 * `bounced` row of `notification_log` that the outbox suppression reads
 * (AC:U2:7): from then on every mail to the address, of either class, is
 * suppressed, and an obligatory one is escalated as undeliverable (AC:U2:4).
 *
 * The synchronous half (the provider refusing the address while accepting the
 * request) lives in the transport, which throws `EmailHardBounceError`.
 *
 * @module services/outbox/email-provider-bounce
 */

import type { NotificationLogModel } from '@repo/db';

/** Input of {@link buildProviderHardBounceKey}. */
export interface BuildProviderHardBounceKeyInput {
    /** Provider that reported the bounce (e.g. `brevo`). */
    readonly provider: string;
    /** Address reported as bounced. */
    readonly recipient: string;
    /** Provider message id of the bounced mail, when the event carries it. */
    readonly messageId?: string | null;
}

/**
 * Builds the idempotency key of one provider hard-bounce event.
 *
 * With a message id, the key is the (address, message) pair, so a redelivery
 * of the same event is a no-op while a bounce of another message is still
 * recorded. Without one (the provider's marketing events carry none), the key
 * is the address alone: a single `bounced` row already suppresses that address
 * forever, so a second one would add nothing.
 *
 * @param input - Provider, recipient and optional message id.
 * @returns The key stored as `metadata.idempotencyKey`.
 */
export function buildProviderHardBounceKey(input: BuildProviderHardBounceKeyInput): {
    readonly idempotencyKey: string;
} {
    const recipient = input.recipient.trim().toLowerCase();
    const messageId = input.messageId?.trim();
    const base = `${input.provider}:hard_bounce:${recipient}`;
    return { idempotencyKey: messageId ? `${base}:${messageId}` : base };
}

/** Input of {@link recordProviderHardBounce}. */
export interface RecordProviderHardBounceEventInput {
    readonly log: Pick<NotificationLogModel, 'recordProviderHardBounce'>;
    /** Provider that reported the bounce (e.g. `brevo`). */
    readonly provider: string;
    /** Address reported as bounced. */
    readonly recipient: string;
    /** Provider message id of the bounced mail, when the event carries it. */
    readonly messageId?: string | null;
    /** Bounce reason reported by the provider. */
    readonly reason?: string | null;
    /** Instant the provider reports for the event. */
    readonly at: Date;
}

/**
 * Records one provider hard-bounce event as the idempotent `bounced` row of
 * the address.
 *
 * @param input - The event and the log model.
 * @returns `inserted: false` when the same event was already recorded.
 * @throws DbError if the write fails; the caller decides whether to ask the
 *   provider for a redelivery.
 */
export async function recordProviderHardBounce(
    input: RecordProviderHardBounceEventInput
): Promise<{ readonly inserted: boolean; readonly idempotencyKey: string }> {
    const recipient = input.recipient.trim();
    const { idempotencyKey } = buildProviderHardBounceKey({
        provider: input.provider,
        recipient,
        messageId: input.messageId
    });
    const { inserted } = await input.log.recordProviderHardBounce({
        recipient,
        provider: input.provider,
        idempotencyKey,
        at: input.at,
        providerMessageId: input.messageId ?? null,
        reason: input.reason ?? null
    });
    return { inserted, idempotencyKey };
}
