import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import { BaseModelImpl } from '../../base/base.model.ts';
import {
    type EmailOutboxStatus,
    emailOutbox
} from '../../schemas/email-outbox/email_outbox.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';
import { DbError } from '../../utils/error.ts';
import { logError, logQuery } from '../../utils/logger.ts';

/**
 * Normalizes `db.execute()` output: an array (postgres-js) or `{ rows }`
 * (node-postgres), as the sibling models do.
 */
function extractRows<T>(result: unknown): T[] {
    return Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] }).rows ?? []);
}

/**
 * Short stable digest of a dedup key for logs and error params. The raw key can
 * embed a recipient address, so it must never reach them.
 */
function keyDigest(dedupKey: string): string {
    return createHash('sha256').update(dedupKey).digest('hex').slice(0, 16);
}

/** Row type of the `email_outbox` table. */
export type EmailOutboxRow = typeof emailOutbox.$inferSelect;

/** Input of {@link EmailOutboxModel.enqueue}. */
export interface EnqueueEmailInput {
    /** Account the mail is for, when there is one. */
    readonly recipientUserId?: string | null;
    /** Address to mail, captured now. The sender never re-reads it from the account. */
    readonly recipientEmail: string;
    /** Template identifier. */
    readonly template: string;
    /** Template variables. */
    readonly payload?: Record<string, unknown>;
    /** Dedup key from `buildEmailDedupKey`, computed before this call. */
    readonly dedupKey: string;
    /** Delivery channel. Defaults to `email`. */
    readonly channel?: string;
}

/** Result of {@link EmailOutboxModel.enqueue}. */
export interface EnqueueEmailResult {
    /** `true` when a new row was written; `false` when the dedup key already existed. */
    readonly enqueued: boolean;
    /** The new row, or `null` when the key already existed. */
    readonly row: EmailOutboxRow | null;
}

/** Input of {@link EmailOutboxModel.claim}. */
export interface ClaimEmailsInput {
    /** Identifier of the sender process taking the rows. */
    readonly owner: string;
    /** Lease length in milliseconds. */
    readonly leaseMs: number;
    /** Maximum rows to take. */
    readonly limit: number;
    /** Reference instant; defaults to now. */
    readonly now?: Date;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** Input of {@link EmailOutboxModel.recoverExpired}. */
export interface RecoverExpiredEmailsInput {
    /** Reference instant; defaults to now. */
    readonly now?: Date;
    /** Optional transaction client. */
    readonly tx?: DrizzleClient;
}

/** Input of {@link EmailOutboxModel.markSent}. */
export interface MarkEmailSentInput {
    readonly id: string;
    /** The owner that holds the lease; a row held by someone else is left alone. */
    readonly owner: string;
    readonly providerMessageId: string;
    readonly tx?: DrizzleClient;
}

/** Input of {@link EmailOutboxModel.recordFailure}. */
export interface RecordEmailFailureInput {
    readonly id: string;
    /** The owner that holds the lease; a row held by someone else is left alone. */
    readonly owner: string;
    readonly error: string;
    /** Attempts after which the failure is definitive (`failed`) instead of `retry`. */
    readonly maxAttempts: number;
    readonly tx?: DrizzleClient;
}

/**
 * Model for the `email_outbox` table (HOS-1422).
 *
 * Generic CRUD comes from {@link BaseModelImpl}. The queue operations that
 * need atomic, race-free SQL (dedup insert, claim with `SKIP LOCKED`, lease
 * recovery) live here and take an optional transaction client so a domain
 * transition can enqueue inside its own transaction.
 */
export class EmailOutboxModel extends BaseModelImpl<EmailOutboxRow> {
    protected table = emailOutbox;
    public entityName = 'emailOutbox';

    protected getTableName(): string {
        return 'emailOutbox';
    }

    /**
     * Enqueues one mail. Pass the CALLER'S transaction so the row commits (or
     * rolls back) together with the domain write.
     *
     * Enqueueing a dedup key that already exists is a no-op, not an error:
     * the insert uses `ON CONFLICT (dedup_key) DO NOTHING`, so two parallel
     * enqueues of the same key leave exactly one row.
     *
     * @param input - Mail to enqueue.
     * @param tx - The domain transaction. Omit only when there is no domain write to pair with.
     * @returns Whether a row was written, and the row.
     * @throws DbError if the insert fails.
     */
    async enqueue(input: EnqueueEmailInput, tx?: DrizzleClient): Promise<EnqueueEmailResult> {
        const db = this.getClient(tx);
        const logContext = {
            dedupKeyDigest: keyDigest(input.dedupKey),
            recipientUserId: input.recipientUserId ?? null
        };
        try {
            const rows = await db
                .insert(emailOutbox)
                .values({
                    recipientUserId: input.recipientUserId ?? null,
                    recipientEmail: input.recipientEmail,
                    template: input.template,
                    channel: input.channel ?? 'email',
                    payload: input.payload ?? {},
                    dedupKey: input.dedupKey
                })
                .onConflictDoNothing({ target: emailOutbox.dedupKey })
                .returning();
            const row = rows[0] ?? null;
            this.logOk('enqueue', logContext, { enqueued: row !== null });
            return { enqueued: row !== null, row };
        } catch (error) {
            this.fail('enqueue', logContext, error);
        }
    }

    /**
     * Takes up to `limit` sendable rows (`pending` or `retry`, oldest first),
     * moving them to `processing` with an owner and a lease.
     *
     * One statement with `FOR UPDATE SKIP LOCKED`, so two senders running at
     * once never take the same row.
     *
     * @param input - Owner, lease length, batch size.
     * @returns The rows now held by `owner`.
     * @throws DbError if the update fails.
     */
    async claim(input: ClaimEmailsInput): Promise<EmailOutboxRow[]> {
        const db = this.getClient(input.tx);
        const now = input.now ?? new Date();
        const lockedUntil = new Date(now.getTime() + input.leaseMs);
        const logContext = { owner: input.owner, limit: input.limit };
        try {
            const result = await db.execute(sql`
                UPDATE email_outbox
                SET status = 'processing',
                    locked_by = ${input.owner},
                    locked_until = ${lockedUntil.toISOString()}::timestamptz
                WHERE id IN (
                    SELECT id FROM email_outbox
                    WHERE status IN ('pending', 'retry')
                    ORDER BY created_at ASC
                    LIMIT ${input.limit}
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
            `);
            const ids = extractRows<{ id: string }>(result).map((r) => r.id);
            if (ids.length === 0) {
                this.logOk('claim', logContext, []);
                return [];
            }
            const claimed = await db
                .select()
                .from(emailOutbox)
                .where(inArray(emailOutbox.id, ids))
                .orderBy(asc(emailOutbox.createdAt));
            this.logOk('claim', logContext, claimed);
            return claimed;
        } catch (error) {
            this.fail('claim', logContext, error);
        }
    }

    /**
     * Returns to `pending` every `processing` row whose lease has expired and
     * clears its owner, so no row stays stuck when its sender dies.
     *
     * This is a primitive: nothing schedules it in this unit.
     *
     * @param input - Reference instant and optional transaction.
     * @returns The ids that were released.
     * @throws DbError if the update fails.
     */
    async recoverExpired(input: RecoverExpiredEmailsInput = {}): Promise<string[]> {
        const db = this.getClient(input.tx);
        const now = input.now ?? new Date();
        const logContext = { now: now.toISOString() };
        try {
            const rows = await db
                .update(emailOutbox)
                .set({ status: 'pending', lockedBy: null, lockedUntil: null })
                .where(and(eq(emailOutbox.status, 'processing'), lt(emailOutbox.lockedUntil, now)))
                .returning({ id: emailOutbox.id });
            this.logOk('recoverExpired', logContext, rows);
            return rows.map((r) => r.id);
        } catch (error) {
            this.fail('recoverExpired', logContext, error);
        }
    }

    /**
     * Marks a held row `sent` and stores the provider message id.
     *
     * @param input - Row id, owner and provider id.
     * @returns `true` when the row was held by `owner` and is now `sent`.
     * @throws DbError if the update fails.
     */
    async markSent(input: MarkEmailSentInput): Promise<boolean> {
        const db = this.getClient(input.tx);
        const logContext = { id: input.id, owner: input.owner };
        try {
            const rows = await db
                .update(emailOutbox)
                .set({
                    status: 'sent',
                    providerMessageId: input.providerMessageId,
                    lockedBy: null,
                    lockedUntil: null
                })
                .where(this.heldBy(input.id, input.owner))
                .returning({ id: emailOutbox.id });
            this.logOk('markSent', logContext, rows);
            return rows.length > 0;
        } catch (error) {
            this.fail('markSent', logContext, error);
        }
    }

    /**
     * Records a failed attempt on a held row: increments `attempts`, stores the
     * error and releases the lease. The row becomes `retry`, or `failed` once
     * `attempts` reaches `maxAttempts`.
     *
     * @param input - Row id, owner, error and attempt ceiling.
     * @returns The new status, or `null` when the row was not held by `owner`.
     * @throws DbError if the update fails.
     */
    async recordFailure(input: RecordEmailFailureInput): Promise<EmailOutboxStatus | null> {
        const db = this.getClient(input.tx);
        const logContext = { id: input.id, owner: input.owner, maxAttempts: input.maxAttempts };
        try {
            const rows = await db
                .update(emailOutbox)
                .set({
                    attempts: sql`${emailOutbox.attempts} + 1`,
                    status: sql`CASE WHEN ${emailOutbox.attempts} + 1 >= ${input.maxAttempts} THEN 'failed' ELSE 'retry' END`,
                    lastError: input.error,
                    lockedBy: null,
                    lockedUntil: null
                })
                .where(this.heldBy(input.id, input.owner))
                .returning({ status: emailOutbox.status });
            this.logOk('recordFailure', logContext, rows);
            return rows[0]?.status ?? null;
        } catch (error) {
            this.fail('recordFailure', logContext, error);
        }
    }

    /** Logs a successful query; logging never breaks the operation. */
    private logOk(method: string, context: unknown, result: unknown): void {
        try {
            logQuery(this.entityName, method, context, result);
        } catch {}
    }

    /** Logs and rethrows as a {@link DbError} that keeps the original error as `cause` (HOS-1174). */
    private fail(method: string, context: unknown, error: unknown): never {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            logError(this.entityName, method, context, err);
        } catch {}
        throw new DbError(this.entityName, method, context, err.message, err);
    }

    /** Condition: the row is `processing` and held by `owner`. */
    private heldBy(id: string, owner: string) {
        return and(
            eq(emailOutbox.id, id),
            eq(emailOutbox.status, 'processing'),
            eq(emailOutbox.lockedBy, owner)
        );
    }
}

/** Singleton instance of {@link EmailOutboxModel}. */
export const emailOutboxModel = new EmailOutboxModel();
