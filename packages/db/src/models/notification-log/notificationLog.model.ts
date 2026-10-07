import { and, count, eq, gte, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import { notificationLog } from '../../schemas/notification-log/notification_log.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/** Row type inferred from the notification_log table */
type NotificationLogRow = typeof notificationLog.$inferSelect;

/**
 * Statuses the email outbox sender writes to `notification_log` (HOS-1423).
 *
 * - `sent` / `failed`: one delivery attempt the provider accepted / refused.
 * - `bounced`: the provider reported a HARD bounce. A `bounced` row for an
 *   address is what suppresses every later mail to it (NUCLEO/07 §4.2 cause 1).
 * - `suppressed`: the mail was evaluated and not sent (deleted account,
 *   opt-out, daily cap, or an address that already bounced).
 * - `undeliverable`: the escalation record of a transactional mail that will
 *   never arrive (retries exhausted or hard bounce, NUCLEO/07 §1.3). It is not
 *   an attempt; it stands for the event a person looks at.
 */
export const EMAIL_ATTEMPT_LOG_STATUSES = [
    'sent',
    'failed',
    'bounced',
    'suppressed',
    'undeliverable'
] as const;

/** One status the outbox sender writes to `notification_log`. */
export type EmailAttemptLogStatus = (typeof EMAIL_ATTEMPT_LOG_STATUSES)[number];

/** Mail class recorded in `metadata.emailClass` (NUCLEO/07 §4.1). */
export type EmailDeliveryClass = 'transactional' | 'commercial';

/** Input of {@link NotificationLogModel.recordEmailAttempt}. */
export interface RecordEmailAttemptInput {
    /** Outbox row the record belongs to. */
    readonly outboxId: string;
    /** Address the mail went (or would have gone) to. */
    readonly recipient: string;
    /** Template identifier of the outbox row. */
    readonly template: string;
    /** Rendered subject, or the template id when nothing was rendered. */
    readonly subject: string;
    /** What happened. */
    readonly status: EmailAttemptLogStatus;
    /** Class of the mail; the daily cap counts `commercial` rows only. */
    readonly emailClass: EmailDeliveryClass;
    /** Instant of the record; also `sent_at` when `status` is `sent`. */
    readonly at: Date;
    /** Provider message id on a successful send. */
    readonly providerMessageId?: string | null;
    /** Failure, bounce or suppression reason. */
    readonly errorMessage?: string | null;
    /** Extra metadata merged into `metadata`. */
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly tx?: DrizzleClient;
}

/** Input of {@link NotificationLogModel.hasHardBounce}. */
export interface HasHardBounceInput {
    readonly recipient: string;
    readonly tx?: DrizzleClient;
}

/** Input of {@link NotificationLogModel.countSentByClassSince}. */
export interface CountSentByClassSinceInput {
    readonly recipient: string;
    readonly emailClass: EmailDeliveryClass;
    /** Lower bound (inclusive) of the window. */
    readonly since: Date;
    readonly tx?: DrizzleClient;
}

/**
 * Model for managing notification logs in the database.
 * Extends BaseModel to provide CRUD operations for notification log entities.
 *
 * Since HOS-1423 this table is the ONE record of every email attempt
 * (AC:U2:8): the outbox sender writes one row per attempt here and nowhere
 * else; `email_outbox` only holds queue state.
 */
export class NotificationLogModel extends BaseModelImpl<NotificationLogRow> {
    protected table = notificationLog;
    public entityName = 'notification_log';

    protected getTableName(): string {
        return 'notificationLog';
    }

    /**
     * Writes one record of an outbox mail: an attempt, a suppression or an
     * escalation.
     *
     * @param input - What happened to which outbox row.
     * @returns The inserted row.
     * @throws DbError if the insert fails.
     */
    async recordEmailAttempt(input: RecordEmailAttemptInput): Promise<NotificationLogRow> {
        const db = this.getClient(input.tx);
        const logContext = { outboxId: input.outboxId, status: input.status };
        try {
            const rows = await db
                .insert(notificationLog)
                .values({
                    type: input.template,
                    channel: 'email',
                    recipient: input.recipient,
                    subject: input.subject,
                    templateId: input.template,
                    status: input.status,
                    sentAt: input.status === 'sent' ? input.at : null,
                    errorMessage: input.errorMessage ?? null,
                    createdAt: input.at,
                    metadata: {
                        ...(input.metadata ?? {}),
                        source: 'email_outbox',
                        outboxId: input.outboxId,
                        emailClass: input.emailClass,
                        messageId: input.providerMessageId ?? null
                    }
                })
                .returning();
            const row = rows[0];
            if (!row) {
                throw new Error('notification_log insert returned no row');
            }
            this.logOk('recordEmailAttempt', logContext, row.id);
            return row;
        } catch (error) {
            this.fail('recordEmailAttempt', logContext, error);
        }
    }

    /**
     * Whether an address has ever hard-bounced. A hard bounce suppresses every
     * later mail to that address, forever (DEC-MAIL-001 📌1), so there is no
     * time window. The comparison is case-insensitive.
     *
     * @param input - Recipient address.
     * @returns `true` when a `bounced` row exists for the address.
     * @throws DbError if the query fails.
     */
    async hasHardBounce(input: HasHardBounceInput): Promise<boolean> {
        const db = this.getClient(input.tx);
        const logContext = { op: 'hasHardBounce' };
        try {
            const rows = await db
                .select({ id: notificationLog.id })
                .from(notificationLog)
                .where(
                    and(
                        eq(notificationLog.status, 'bounced'),
                        sql`lower(${notificationLog.recipient}) = lower(${input.recipient})`
                    )
                )
                .limit(1);
            this.logOk('hasHardBounce', logContext, rows.length);
            return rows.length > 0;
        } catch (error) {
            this.fail('hasHardBounce', logContext, error);
        }
    }

    /**
     * Counts the mails of one class SENT to an address since an instant. The
     * daily cap (NUCLEO/07 §4.3) counts per recipient, never globally.
     *
     * @param input - Recipient, class and window start.
     * @returns The number of `sent` rows.
     * @throws DbError if the query fails.
     */
    async countSentByClassSince(input: CountSentByClassSinceInput): Promise<number> {
        const db = this.getClient(input.tx);
        const logContext = { op: 'countSentByClassSince', emailClass: input.emailClass };
        try {
            const rows = await db
                .select({ total: count() })
                .from(notificationLog)
                .where(
                    and(
                        eq(notificationLog.status, 'sent'),
                        sql`lower(${notificationLog.recipient}) = lower(${input.recipient})`,
                        sql`${notificationLog.metadata}->>'emailClass' = ${input.emailClass}`,
                        gte(notificationLog.createdAt, input.since)
                    )
                );
            const total = Number(rows[0]?.total ?? 0);
            this.logOk('countSentByClassSince', logContext, total);
            return total;
        } catch (error) {
            this.fail('countSentByClassSince', logContext, error);
        }
    }

    /** Logs a successful query; logging never breaks the operation. */
    private logOk(method: string, context: unknown, result: unknown): void {
        try {
            logQuery(this.entityName, method, context, result);
        } catch {}
    }

    /** Logs and rethrows as a {@link DbError} that keeps the original error as `cause`. */
    private fail(method: string, context: unknown, error: unknown): never {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            logError(this.entityName, method, context, err);
        } catch {}
        throw new DbError(this.entityName, method, context, err.message, err);
    }
}

/** Singleton instance of NotificationLogModel for use across the application. */
export const notificationLogModel = new NotificationLogModel();
