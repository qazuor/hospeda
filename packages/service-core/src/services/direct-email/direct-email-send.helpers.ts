/**
 * @module direct-email-send.helpers
 *
 * Send-side helpers of the direct email message service (HOS-2685): the per-recipient
 * mailer call, the batch deadline constants and the replay mapping of an idempotent send.
 */

import type { DirectEmailMessageModel, DirectEmailRecipientModel } from '@repo/db';
import type { DirectEmailRecipientRow, SendDirectEmailResponse } from '@repo/schemas';
import { DirectEmailRecipientStatusEnum, ServiceErrorCode } from '@repo/schemas';
import type { ServiceContext } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';
import type { DirectEmailMailerPort } from './direct-email.ports.js';
import { generateDirectEmailOptOutToken } from './direct-email-token.helpers.js';

/** Recipient row status written for each send result. */
const RECIPIENT_STATUS_BY_RESULT = {
    sent: DirectEmailRecipientStatusEnum.SENT,
    failed: DirectEmailRecipientStatusEnum.FAILED,
    suppressed: DirectEmailRecipientStatusEnum.SUPPRESSED
} as const;

/**
 * Wall-clock budget of one send batch. The admin request has to answer before the proxy
 * cuts it (about 100 s), so past this point no new recipient is started.
 */
export const DIRECT_EMAIL_BATCH_DEADLINE_MS = 75_000;

/** `error` recorded on the recipients the batch deadline left unsent. */
export const DIRECT_EMAIL_TIMEOUT_ERROR = 'timeout';

/** One entry of the per-recipient results of a send. */
export type DirectEmailSendResultRow = SendDirectEmailResponse['results'][number];

/**
 * Display name of the sender: `<first name> de Hospeda`, or `Hospeda` when the admin has
 * no name on file.
 *
 * @param name - The actor's display name
 * @returns The From display name, before any environment marker
 */
export function buildDirectEmailFromName(name: string | undefined): string {
    const first = name?.trim().split(/\s+/)[0];
    return first ? `${first} de Hospeda` : 'Hospeda';
}

/**
 * Sends to one recipient; a throwing mailer counts as a failed send.
 *
 * @param input - Mailer, recipient, content and sender
 * @returns `sent` with the provider message id, or `failed` with the provider error
 */
export async function sendToOneRecipient(input: {
    readonly mailer: DirectEmailMailerPort;
    readonly email: string;
    readonly subject: string;
    readonly bodyJson: Parameters<DirectEmailMailerPort['send']>[0]['bodyJson'];
    readonly optOutUrl: string;
    readonly fromEmail: string;
    readonly fromName: string;
    readonly replyTo: string;
}): Promise<DirectEmailSendResultRow> {
    const { mailer, email } = input;
    try {
        const outcome = await mailer.send({
            to: email,
            subject: input.subject,
            bodyJson: input.bodyJson,
            optOutUrl: input.optOutUrl,
            isTest: false,
            fromEmail: input.fromEmail,
            fromName: input.fromName,
            replyTo: input.replyTo
        });
        if (outcome.success) {
            return {
                email,
                status: 'sent',
                providerMessageId: outcome.messageId ?? null,
                error: null
            };
        }
        return {
            email,
            status: 'failed',
            providerMessageId: null,
            error: outcome.error ?? 'Unknown provider error'
        };
    } catch (error) {
        return {
            email,
            status: 'failed',
            providerMessageId: null,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

/**
 * Rebuilds the per-recipient results of a stored message, for an idempotent replay.
 * Rows the webhook already advanced (`delivered`, `opened`, `bounced`) were all sent.
 *
 * @param rows - The message's recipient rows
 * @returns The results in the shape of the original response
 */
export function replayResultsFromRows(
    rows: readonly DirectEmailRecipientRow[]
): SendDirectEmailResponse['results'] {
    return rows.map((row) => ({
        email: row.email,
        status:
            row.status === DirectEmailRecipientStatusEnum.FAILED
                ? ('failed' as const)
                : row.status === DirectEmailRecipientStatusEnum.SUPPRESSED
                  ? ('suppressed' as const)
                  : ('sent' as const),
        providerMessageId: row.providerMessageId,
        error: row.errorMessage
    }));
}

/**
 * The stored result of a message already sent with this idempotency key.
 *
 * @param input.idempotencyKey - Client UUID of the compose session
 * @param input.actorId - The sending admin; a key owned by another admin is refused
 * @returns The original response shape, or `null` when the key is new
 * @throws {ServiceError} ALREADY_EXISTS when another admin owns the key
 */
export async function findReplay(input: {
    readonly messageModel: DirectEmailMessageModel;
    readonly recipientModel: DirectEmailRecipientModel;
    readonly idempotencyKey: string;
    readonly actorId: string;
    readonly tx: ServiceContext['tx'];
}): Promise<SendDirectEmailResponse | null> {
    const existing = await input.messageModel.findByIdempotencyKey(input.idempotencyKey, input.tx);
    if (!existing) return null;
    if (existing.sentBy !== input.actorId) {
        throw new ServiceError(
            ServiceErrorCode.ALREADY_EXISTS,
            'That send key belongs to another message.',
            undefined,
            'DIRECT_EMAIL_IDEMPOTENCY_KEY_CONFLICT'
        );
    }
    const rows = await input.recipientModel.findByMessageId(existing.id, input.tx);
    return { messageId: existing.id, results: replayResultsFromRows(rows) };
}

/**
 * Writes the recipient row. A failed write is logged, never thrown: the mail already
 * left (or was skipped) and the remaining recipients must still be processed.
 *
 * @param input - Message id, the send result and the recipient's opt-out token
 */
export async function recordRecipient(input: {
    readonly recipientModel: DirectEmailRecipientModel;
    readonly logger: { error(message: string): void };
    readonly messageId: string;
    readonly result: DirectEmailSendResultRow;
    readonly optOutToken: string;
    readonly tx: ServiceContext['tx'];
}): Promise<void> {
    const { messageId, result, optOutToken } = input;
    try {
        await input.recipientModel.create(
            {
                messageId,
                email: result.email,
                optOutToken,
                status: RECIPIENT_STATUS_BY_RESULT[result.status],
                providerMessageId: result.providerMessageId,
                errorMessage: result.error,
                sentAt: result.status === 'sent' ? new Date() : null,
                deliveredAt: null,
                openedAt: null,
                bouncedAt: null
            },
            input.tx
        );
    } catch (error) {
        input.logger.error(
            `Failed to record direct email recipient (message ${messageId}, status ${result.status}): ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }
}

/**
 * Sends to every recipient in request order and records each outcome as it happens.
 *
 * Suppressed addresses are skipped and reported. Once `startedAt` is
 * {@link DIRECT_EMAIL_BATCH_DEADLINE_MS} behind the clock no new send starts: the rest are
 * reported `failed` with error `timeout`. Each recipient gets its own opt-out token.
 *
 * @param input - Recipients, content, sender, clock and the recording callback
 * @returns One result per recipient, in request order
 */
export async function sendRecipientsInOrder(input: {
    readonly recipients: readonly string[];
    readonly suppressed: ReadonlySet<string>;
    readonly mailer: DirectEmailMailerPort;
    readonly subject: string;
    readonly bodyJson: Parameters<DirectEmailMailerPort['send']>[0]['bodyJson'];
    readonly fromEmail: string;
    readonly fromName: string;
    readonly replyTo: string;
    readonly optOutUrlFor: (token: string) => string;
    readonly now: () => number;
    readonly startedAt: number;
    readonly record: (row: {
        readonly result: DirectEmailSendResultRow;
        readonly optOutToken: string;
    }) => Promise<void>;
}): Promise<SendDirectEmailResponse['results']> {
    const results: DirectEmailSendResultRow[] = [];
    for (const email of input.recipients) {
        const optOutToken = generateDirectEmailOptOutToken();
        let result: DirectEmailSendResultRow;
        if (input.suppressed.has(email)) {
            result = { email, status: 'suppressed', providerMessageId: null, error: null };
        } else if (input.now() - input.startedAt >= DIRECT_EMAIL_BATCH_DEADLINE_MS) {
            result = {
                email,
                status: 'failed',
                providerMessageId: null,
                error: DIRECT_EMAIL_TIMEOUT_ERROR
            };
        } else {
            result = await sendToOneRecipient({
                mailer: input.mailer,
                email,
                subject: input.subject,
                bodyJson: input.bodyJson,
                optOutUrl: input.optOutUrlFor(optOutToken),
                fromEmail: input.fromEmail,
                fromName: input.fromName,
                replyTo: input.replyTo
            });
        }
        results.push(result);
        await input.record({ result, optOutToken });
    }
    return results;
}
