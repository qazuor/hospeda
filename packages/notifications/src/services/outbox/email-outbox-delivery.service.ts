/**
 * Email outbox delivery (HOS-1423, unit U2: AC:U2:4, AC:U2:7, AC:U2:8;
 * HOS-1424: AC:U2:6, AC:U2:9).
 *
 * One batch of the outbox sender: release expired leases, claim sendable rows,
 * apply suppression, send, and record every attempt in `notification_log`,
 * the single attempt log. `email_outbox` keeps only queue state, and the
 * Redis RetryService is never involved: a failed attempt goes back to the
 * queue as `retry` and the next run claims it again.
 *
 * Nothing here runs inside a domain transaction. A failure of any kind ends
 * as queue state plus a log row, never as an error the domain action waits on
 * (INV:25).
 *
 * Each row is processed under ITS OWN correlation (NUCLEO/08 §2.3): the one
 * its enqueuing intention stored on the row, or a fresh one when the row has
 * none. The correlation travels to the escalation, never to the provider.
 *
 * @module services/outbox/email-outbox-delivery
 */

import { randomUUID } from 'node:crypto';
import type {
    EmailOutboxModel,
    EmailOutboxRow,
    EmailOutboxStatus,
    NotificationLogModel
} from '@repo/db';
import { startOfMarketDay } from '@repo/utils';
import type { ReactElement } from 'react';
import { EMAIL_OUTBOX_CONSTANTS } from '../../constants/notification.constants.js';
import type { EmailTransport } from '../../transports/email/email-transport.interface.js';
import { NotificationType } from '../../types/notification.types.js';
import type { PreferenceService } from '../preference.service.js';
import {
    classifyOutboxTemplate,
    evaluateOutboxSuppression,
    type OutboxEmailClass
} from './email-outbox-suppression.js';

/**
 * `last_error` markers of a row that will never be sent. `failed` plus one of
 * these is what "undeliverable" means; the status CHECK is not widened.
 */
export const OUTBOX_LAST_ERROR_MARKERS = {
    HARD_BOUNCE: 'undeliverable:hard_bounce',
    RETRIES_EXHAUSTED: 'undeliverable:retries_exhausted',
    ACCOUNT_DELETED: 'suppressed:account_deleted',
    OPT_OUT: 'suppressed:opt_out',
    DAILY_CAP: 'suppressed:daily_cap'
} as const;

/**
 * Thrown by a transport (or renderer) when the provider rejects the address
 * itself: a hard bounce. The sender records a `bounced` row, so every later
 * mail to that address is suppressed, and fails the outbox row at once.
 */
export class EmailHardBounceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EmailHardBounceError';
    }
}

/** Thrown by a renderer for a template that no unit has registered yet. */
export class OutboxTemplateNotRegisteredError extends Error {
    constructor(template: string) {
        super(`No outbox renderer registered for template "${template}"`);
        this.name = 'OutboxTemplateNotRegisteredError';
    }
}

/** A rendered outbox mail. */
export interface OutboxRenderedMail {
    readonly subject: string;
    readonly react: ReactElement;
}

/** Renders one outbox row. Throw {@link OutboxTemplateNotRegisteredError} for an unknown template. */
export type OutboxMailRenderer = (input: {
    readonly row: EmailOutboxRow;
}) => OutboxRenderedMail | Promise<OutboxRenderedMail>;

/** Why a transactional mail was escalated. */
export type OutboxEscalationReason = 'hard_bounce' | 'retries_exhausted';

/** The escalation of a transactional mail that will never arrive (NUCLEO/07 §1.3). */
export interface OutboxEscalation {
    readonly outboxId: string;
    readonly template: string;
    readonly recipientUserId: string | null;
    readonly reason: OutboxEscalationReason;
    readonly attempts: number;
    readonly lastError: string | null;
    /**
     * The row's correlation: the one stored at enqueue, or the one minted for
     * this item when the row had none (NUCLEO/08 §2.3).
     */
    readonly correlationId: string;
}

/** Dependencies of {@link processEmailOutboxBatch}. */
export interface EmailOutboxDeliveryDeps {
    readonly outbox: Pick<
        EmailOutboxModel,
        | 'recoverExpired'
        | 'claim'
        | 'markSent'
        | 'recordFailure'
        | 'markFailed'
        | 'getRecipientDeletedAt'
    >;
    readonly log: Pick<
        NotificationLogModel,
        'recordEmailAttempt' | 'hasHardBounce' | 'countSentByClassSince'
    >;
    /** Whether the account opted out of this template. Only asked for commercial mail. */
    readonly isOptedOut: (input: {
        readonly userId: string;
        readonly template: string;
    }) => Promise<boolean>;
    readonly render: OutboxMailRenderer;
    readonly transport: EmailTransport;
    /**
     * Raises the escalation where a person sees it. The cron wires it to an
     * `error` log with `capture: true` (Sentry) and an `email.undeliverable`
     * row in `domain_event` (HOS-1424). Awaited; the queue state is already
     * written when it runs, so nothing it does can roll that back. Must not
     * throw: a failed event write is logged by the hook itself.
     */
    readonly escalate: (event: OutboxEscalation) => Promise<void>;
    /**
     * Reports a row whose processing threw (a DB read or write failed). The
     * row stays `processing` until its lease expires and `recoverExpired`
     * returns it to `pending` WITHOUT counting an attempt, so a row that
     * always throws is retried indefinitely; this report is what makes that
     * visible. The cron wires it to an `error` log. Must not throw.
     */
    readonly onRowError: (event: OutboxRowError) => void;
    /**
     * Reports a mail the provider accepted whose row this sender no longer
     * held when marking it `sent` (the lease expired mid-send and another
     * sender may take it again). The cron wires it to a `warn` log. Must not throw.
     */
    readonly onLeaseLost: (event: OutboxLeaseLost) => void;
}

/** A row whose processing threw. */
export interface OutboxRowError {
    readonly outboxId: string;
    readonly template: string;
    readonly error: string;
}

/** A sent row whose lease was lost before it could be marked `sent`. */
export interface OutboxLeaseLost {
    readonly outboxId: string;
    readonly template: string;
    readonly providerMessageId: string;
}

/** Input of {@link processEmailOutboxBatch}. */
export interface ProcessEmailOutboxBatchInput {
    readonly deps: EmailOutboxDeliveryDeps;
    /** Sender identity written as `locked_by`. */
    readonly owner: string;
    /** The run's instant. Every lease, window and record of the batch uses it. */
    readonly now: Date;
    readonly leaseMs: number;
    readonly batchSize: number;
    readonly maxAttempts?: number;
    readonly dailyCap?: number;
}

/** Counters of one batch. */
export interface ProcessEmailOutboxBatchResult {
    readonly recovered: number;
    readonly claimed: number;
    readonly sent: number;
    readonly retried: number;
    readonly failed: number;
    readonly suppressed: number;
    readonly escalated: number;
    /** Rows whose processing threw; they stay `processing` until their lease expires. */
    readonly errors: number;
}

type RowOutcome = 'sent' | 'retried' | 'failed' | 'suppressed';

interface RowContext {
    readonly deps: EmailOutboxDeliveryDeps;
    readonly row: EmailOutboxRow;
    readonly owner: string;
    readonly now: Date;
    readonly emailClass: OutboxEmailClass;
    readonly maxAttempts: number;
    /** The item's correlation (the row's, or minted for it). */
    readonly correlationId: string;
}

/**
 * Builds the opt-out reader the sender needs from the existing
 * {@link PreferenceService}. A template that is not a {@link NotificationType}
 * has no preference to read, so it is never opted out.
 *
 * @param input - The preference service.
 * @returns The `isOptedOut` dependency.
 */
export function createOutboxOptOutReader(input: {
    readonly preferenceService: Pick<PreferenceService, 'shouldSendNotification'>;
}): EmailOutboxDeliveryDeps['isOptedOut'] {
    const knownTypes = new Set<string>(Object.values(NotificationType));
    return async ({ userId, template }) => {
        if (!knownTypes.has(template)) {
            return false;
        }
        const shouldSend = await input.preferenceService.shouldSendNotification(
            userId,
            template as NotificationType
        );
        return !shouldSend;
    };
}

/**
 * Runs one batch of the outbox sender.
 *
 * @param input - Dependencies, owner, run instant and limits.
 * @returns Counters of what happened.
 */
export async function processEmailOutboxBatch(
    input: ProcessEmailOutboxBatchInput
): Promise<ProcessEmailOutboxBatchResult> {
    const { deps, owner, now } = input;
    const maxAttempts = input.maxAttempts ?? EMAIL_OUTBOX_CONSTANTS.MAX_ATTEMPTS;
    const dailyCap = input.dailyCap ?? EMAIL_OUTBOX_CONSTANTS.DAILY_COMMERCIAL_CAP_PER_RECIPIENT;
    // The daily cap counts the market's calendar day so far, from midnight in
    // America/Argentina/Buenos_Aires to now, not a rolling 24 hours (AC:U2:6).
    const capWindowStart = startOfMarketDay({ instant: now });

    const recovered = await deps.outbox.recoverExpired({ now });
    const rows = await deps.outbox.claim({
        owner,
        leaseMs: input.leaseMs,
        limit: input.batchSize,
        now
    });

    const counts = { sent: 0, retried: 0, failed: 0, suppressed: 0, escalated: 0, errors: 0 };

    for (const row of rows) {
        const { emailClass } = classifyOutboxTemplate({ template: row.template });
        const correlationId = row.correlationId ?? randomUUID();
        const ctx: RowContext = { deps, row, owner, now, emailClass, maxAttempts, correlationId };
        try {
            const decision = evaluateOutboxSuppression(
                await readSuppressionFacts({
                    ctx,
                    dailyCap,
                    since: capWindowStart
                })
            );
            let outcome: RowOutcome;
            let escalated = false;
            if (decision.suppressed) {
                escalated = await suppressRow({
                    ctx,
                    cause: decision.cause,
                    escalate: decision.escalate
                });
                outcome = 'suppressed';
            } else {
                const result = await sendRow({ ctx });
                outcome = result.outcome;
                escalated = result.escalated;
            }
            counts[outcome] += 1;
            if (escalated) counts.escalated += 1;
        } catch (error) {
            counts.errors += 1;
            deps.onRowError({
                outboxId: row.id,
                template: row.template,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    return { recovered: recovered.length, claimed: rows.length, ...counts };
}

/** Reads the facts the evaluator needs for one row, skipping commercial-only reads for transactional mail. */
async function readSuppressionFacts(input: {
    readonly ctx: RowContext;
    readonly dailyCap: number;
    readonly since: Date;
}) {
    const { deps, row, emailClass } = input.ctx;
    const isCommercial = emailClass === 'commercial';
    const userId = row.recipientUserId;

    const hasHardBounce = await deps.log.hasHardBounce({ recipient: row.recipientEmail });
    const accountDeletedAt = userId
        ? await deps.outbox.getRecipientDeletedAt({ recipientUserId: userId })
        : null;
    const optedOut =
        isCommercial && userId ? await deps.isOptedOut({ userId, template: row.template }) : false;
    const commercialSentInWindow = isCommercial
        ? await deps.log.countSentByClassSince({
              recipient: row.recipientEmail,
              emailClass: 'commercial',
              since: input.since
          })
        : 0;

    return {
        emailClass,
        hasHardBounce,
        accountDeletedAt,
        enqueuedAt: row.createdAt,
        optedOut,
        commercialSentInWindow,
        dailyCap: input.dailyCap
    };
}

const SUPPRESSION_MARKER = {
    hard_bounce: OUTBOX_LAST_ERROR_MARKERS.HARD_BOUNCE,
    account_deleted: OUTBOX_LAST_ERROR_MARKERS.ACCOUNT_DELETED,
    opt_out: OUTBOX_LAST_ERROR_MARKERS.OPT_OUT,
    daily_cap: OUTBOX_LAST_ERROR_MARKERS.DAILY_CAP
} as const;

/** Fails a suppressed row without counting an attempt, records it, and escalates when asked. */
async function suppressRow(input: {
    readonly ctx: RowContext;
    readonly cause: keyof typeof SUPPRESSION_MARKER;
    readonly escalate: boolean;
}): Promise<boolean> {
    const { deps, row, owner, now, emailClass } = input.ctx;
    const marker = SUPPRESSION_MARKER[input.cause];
    await deps.outbox.markFailed({ id: row.id, owner, marker });
    await deps.log.recordEmailAttempt({
        outboxId: row.id,
        recipient: row.recipientEmail,
        template: row.template,
        subject: row.template,
        status: 'suppressed',
        emailClass,
        at: now,
        errorMessage: marker,
        metadata: { kind: 'suppression', cause: input.cause }
    });
    if (input.escalate) {
        await escalateRow({
            ctx: input.ctx,
            reason: 'hard_bounce',
            attempts: row.attempts,
            lastError: marker
        });
        return true;
    }
    return false;
}

/**
 * Renders and sends one row, recording exactly one attempt. Only the render
 * and the provider call sit inside the `try`: once the provider accepted the
 * mail, a failure writing that down must never be read as a failed send (it
 * would re-send).
 */
async function sendRow(input: {
    readonly ctx: RowContext;
}): Promise<{ readonly outcome: RowOutcome; readonly escalated: boolean }> {
    const { deps, row, owner, now, emailClass } = input.ctx;
    let subject = row.template;
    let messageId: string;
    try {
        const mail = await deps.render({ row });
        subject = mail.subject;
        const result = await deps.transport.send({
            to: row.recipientEmail,
            subject: mail.subject,
            react: mail.react,
            tags: [
                { name: 'notification_type', value: row.template },
                { name: 'category', value: emailClass },
                { name: 'source', value: 'email_outbox' }
            ]
        });
        messageId = result.messageId;
    } catch (error) {
        return handleSendFailure({ ctx: input.ctx, subject, error });
    }

    const marked = await deps.outbox.markSent({ id: row.id, owner, providerMessageId: messageId });
    if (!marked) {
        deps.onLeaseLost({
            outboxId: row.id,
            template: row.template,
            providerMessageId: messageId
        });
    }
    await deps.log.recordEmailAttempt({
        outboxId: row.id,
        recipient: row.recipientEmail,
        template: row.template,
        subject,
        status: 'sent',
        emailClass,
        at: now,
        providerMessageId: messageId,
        metadata: { kind: 'attempt', attempt: row.attempts + 1 }
    });
    return { outcome: 'sent', escalated: false };
}

/** Records a refused attempt: a hard bounce fails the row at once; anything else retries until exhausted. */
async function handleSendFailure(input: {
    readonly ctx: RowContext;
    readonly subject: string;
    readonly error: unknown;
}): Promise<{ readonly outcome: RowOutcome; readonly escalated: boolean }> {
    const { deps, row, owner, now, emailClass, maxAttempts } = input.ctx;
    const message = input.error instanceof Error ? input.error.message : String(input.error);
    const attempt = row.attempts + 1;
    const isHardBounce = input.error instanceof EmailHardBounceError;
    const isFinal = isHardBounce || attempt >= maxAttempts;

    let lastError = message;
    if (isHardBounce) {
        lastError = `${OUTBOX_LAST_ERROR_MARKERS.HARD_BOUNCE}: ${message}`;
    } else if (isFinal) {
        lastError = `${OUTBOX_LAST_ERROR_MARKERS.RETRIES_EXHAUSTED}: ${message}`;
    }

    const status: EmailOutboxStatus | null = await deps.outbox.recordFailure({
        id: row.id,
        owner,
        error: lastError,
        // A hard bounce is definitive on its first attempt.
        maxAttempts: isHardBounce ? 1 : maxAttempts
    });
    await deps.log.recordEmailAttempt({
        outboxId: row.id,
        recipient: row.recipientEmail,
        template: row.template,
        subject: input.subject,
        status: isHardBounce ? 'bounced' : 'failed',
        emailClass,
        at: now,
        errorMessage: message,
        metadata: { kind: 'attempt', attempt }
    });

    if (status !== 'failed') {
        return { outcome: 'retried', escalated: false };
    }
    const escalated = emailClass === 'transactional';
    if (escalated) {
        await escalateRow({
            ctx: input.ctx,
            reason: isHardBounce ? 'hard_bounce' : 'retries_exhausted',
            attempts: attempt,
            lastError
        });
    }
    return { outcome: 'failed', escalated };
}

/** Writes the `undeliverable` escalation record and raises (and awaits) the escalation. */
async function escalateRow(input: {
    readonly ctx: RowContext;
    readonly reason: OutboxEscalationReason;
    readonly attempts: number;
    readonly lastError: string;
}): Promise<void> {
    const { deps, row, now, emailClass, correlationId } = input.ctx;
    await deps.log.recordEmailAttempt({
        outboxId: row.id,
        recipient: row.recipientEmail,
        template: row.template,
        subject: row.template,
        status: 'undeliverable',
        emailClass,
        at: now,
        errorMessage: input.lastError,
        metadata: { kind: 'escalation', reason: input.reason, attempts: input.attempts }
    });
    await deps.escalate({
        outboxId: row.id,
        template: row.template,
        recipientUserId: row.recipientUserId,
        reason: input.reason,
        attempts: input.attempts,
        lastError: input.lastError,
        correlationId
    });
}
