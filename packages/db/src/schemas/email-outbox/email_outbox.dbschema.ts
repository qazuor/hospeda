import { sql } from 'drizzle-orm';
import {
    check,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Lifecycle states of an outbox row (NUCLEO/07 §1, the §44 states).
 *
 * Stored as varchar guarded by a CHECK constraint rather than a pg enum: the
 * set is closed and local to this table, and a pg enum would drag a new
 * `@repo/schemas` enum (and its frozen-count guards) into a mechanism that no
 * API surface exposes.
 */
export const EMAIL_OUTBOX_STATUSES = ['pending', 'processing', 'sent', 'failed', 'retry'] as const;

/** One lifecycle state of an `email_outbox` row. */
export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];

/**
 * Email outbox table (HOS-1422, unit U2).
 *
 * A domain transition writes its own state AND one row here in the SAME
 * transaction; a separate process reads the queue and sends. If the send
 * fails, the row stays `pending`/`retry` and the domain action stays too.
 *
 * Design notes:
 * - `recipient_email` is captured AT ENQUEUE. The sender mails that address,
 *   not whatever the account holds when the row is picked up (a deactivation
 *   that pseudonymizes the account must not redirect an already-queued mail).
 * - `recipient_user_id` is a reference only (SET NULL on user delete); it is
 *   never what the sender resolves an address from.
 * - `dedup_key` is `(recipient, template, occurrence)` computed BEFORE
 *   enqueueing and is UNIQUE, so a double-run job, parallel instances or a
 *   retry that re-enqueues cannot produce a second row.
 * - `processing` carries an owner (`locked_by`) and a lease (`locked_until`),
 *   so a dead sender never strands a row: an expired lease goes back to
 *   `pending`.
 * - No `deleted_at`: an outbox row is a record of what was (or was not) sent.
 * - `updated_at` is maintained by the generic `set_updated_at` trigger
 *   (extras/002).
 */
export const emailOutbox = pgTable(
    'email_outbox',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Account the mail is for, when there is one. Reference only; NULL once the account is hard-deleted. */
        recipientUserId: uuid('recipient_user_id').references(() => users.id, {
            onDelete: 'set null'
        }),

        /** Address the sender will mail, captured at enqueue time. */
        recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),

        /** Template identifier the sender renders. */
        template: varchar('template', { length: 100 }).notNull(),

        /** Delivery channel. Always 'email' today. */
        channel: varchar('channel', { length: 20 }).notNull().default('email'),

        /** Template variables, captured at enqueue so the send needs no re-read of domain state. */
        payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),

        /** Lifecycle state. See {@link EMAIL_OUTBOX_STATUSES}. */
        status: varchar('status', { length: 20 })
            .$type<EmailOutboxStatus>()
            .notNull()
            .default('pending'),

        /** `(recipient, template, occurrence)` computed before enqueue. UNIQUE. */
        dedupKey: varchar('dedup_key', { length: 500 }).notNull(),

        /** Sender that holds the row while `processing`. NULL otherwise. */
        lockedBy: varchar('locked_by', { length: 100 }),

        /** Lease expiry while `processing`. NULL otherwise. */
        lockedUntil: timestamp('locked_until', { withTimezone: true }),

        /** Failed delivery attempts so far. */
        attempts: integer('attempts').notNull().default(0),

        /** Provider message id returned on a successful send. */
        providerMessageId: varchar('provider_message_id', { length: 255 }),

        /** Most recent failure reason. */
        lastError: text('last_error'),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** AC:U2:5. One row per (recipient, template, occurrence). */
        email_outbox_dedup_key_uidx: uniqueIndex('email_outbox_dedup_key_uidx').on(table.dedupKey),

        /** Claim (status = pending/retry) and lease recovery (status = processing, expired). */
        email_outbox_status_locked_until_idx: index('email_outbox_status_locked_until_idx').on(
            table.status,
            table.lockedUntil
        ),

        email_outbox_recipient_user_idx: index('email_outbox_recipient_user_idx').on(
            table.recipientUserId
        ),

        email_outbox_status_check: check(
            'email_outbox_status_check',
            sql`${table.status} IN (${sql.raw(EMAIL_OUTBOX_STATUSES.map((status) => `'${status}'`).join(', '))})`
        ),

        /** A `processing` row must always have an owner and a lease. */
        email_outbox_processing_lease_check: check(
            'email_outbox_processing_lease_check',
            sql`${table.status} <> 'processing' OR (${table.lockedBy} IS NOT NULL AND ${table.lockedUntil} IS NOT NULL)`
        )
    })
);

/** Insert shape of an `email_outbox` row. */
export type InsertEmailOutbox = typeof emailOutbox.$inferInsert;
/** Select shape of an `email_outbox` row. */
export type SelectEmailOutbox = typeof emailOutbox.$inferSelect;
