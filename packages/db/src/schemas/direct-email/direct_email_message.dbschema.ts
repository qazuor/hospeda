import { relations } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { directEmailTemplates } from './direct_email_template.dbschema.ts';

/**
 * Direct email messages table (HOS-2685).
 *
 * One row per real send of a one-to-one email composed in the admin panel.
 * `body_json` is the TipTap document as sent: later edits to the template it
 * started from never change it. Test sends create no row.
 */
export const directEmailMessages = pgTable(
    'direct_email_message',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Email subject, as sent. */
        subject: varchar('subject', { length: 200 }).notNull(),

        /** TipTap document JSON, as sent. */
        bodyJson: jsonb('body_json').notNull(),

        /** Template the admin started from. NULL when none, or when it was hard-deleted. */
        templateId: uuid('template_id').references(() => directEmailTemplates.id, {
            onDelete: 'set null'
        }),

        /** FK → users.id. Admin who sent the message. */
        sentBy: uuid('sent_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        /** From address used for this send. */
        fromEmail: text('from_email').notNull(),

        /** Reply-To address: the sending admin's own email. */
        replyToEmail: text('reply_to_email').notNull(),

        /**
         * Client-generated UUID of the compose session. A repeated send with the same key
         * (an admin retrying after a timeout) never sends again: it replays this message.
         */
        idempotencyKey: uuid('idempotency_key').notNull(),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** History list: newest first. */
        direct_email_message_created_at_idx: index('direct_email_message_created_at_idx').on(
            table.createdAt
        ),

        /** Audit: messages by sender. */
        direct_email_message_sent_by_idx: index('direct_email_message_sent_by_idx').on(
            table.sentBy
        ),

        /** One message per compose session (idempotent send). */
        direct_email_message_idempotency_key_uidx: uniqueIndex(
            'direct_email_message_idempotency_key_uidx'
        ).on(table.idempotencyKey)
    })
);

/** Drizzle relations for `direct_email_message`. */
export const directEmailMessagesRelations = relations(directEmailMessages, ({ one }) => ({
    sender: one(users, {
        fields: [directEmailMessages.sentBy],
        references: [users.id]
    }),
    template: one(directEmailTemplates, {
        fields: [directEmailMessages.templateId],
        references: [directEmailTemplates.id]
    })
}));

/** Type inference helpers. */
export type InsertDirectEmailMessage = typeof directEmailMessages.$inferInsert;
export type SelectDirectEmailMessage = typeof directEmailMessages.$inferSelect;
