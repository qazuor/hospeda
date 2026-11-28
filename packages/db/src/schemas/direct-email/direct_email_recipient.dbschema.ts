import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { DirectEmailRecipientStatusPgEnum } from '../enums.dbschema.ts';
import { directEmailMessages } from './direct_email_message.dbschema.ts';

/**
 * Direct email recipients table (HOS-2685).
 *
 * One row per address of a message. Created by the send with `sent`, `failed`
 * or `suppressed`; the Brevo webhook then moves `sent` rows to `delivered`,
 * `opened` or `bounced`, matched by `provider_message_id`.
 */
export const directEmailRecipients = pgTable(
    'direct_email_recipient',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → direct_email_message.id. Dropping a message drops its recipients. */
        messageId: uuid('message_id')
            .notNull()
            .references(() => directEmailMessages.id, { onDelete: 'cascade' }),

        /** Recipient address, lowercased. */
        email: varchar('email', { length: 254 }).notNull(),

        status: DirectEmailRecipientStatusPgEnum('status').notNull(),

        /** Brevo message id returned by the send. Webhook events match on it. */
        providerMessageId: varchar('provider_message_id', { length: 255 }),

        /** Provider error on `failed`. */
        errorMessage: text('error_message'),

        sentAt: timestamp('sent_at', { withTimezone: true }),
        deliveredAt: timestamp('delivered_at', { withTimezone: true }),
        openedAt: timestamp('opened_at', { withTimezone: true }),
        bouncedAt: timestamp('bounced_at', { withTimezone: true })
    },
    (table) => ({
        /** Detail page: recipients of one message. */
        direct_email_recipient_message_idx: index('direct_email_recipient_message_idx').on(
            table.messageId
        ),

        /** Brevo webhook lookup by message id. */
        direct_email_recipient_provider_message_id_idx: index(
            'direct_email_recipient_provider_message_id_idx'
        ).on(table.providerMessageId)
    })
);

/** Drizzle relations for `direct_email_recipient`. */
export const directEmailRecipientsRelations = relations(directEmailRecipients, ({ one }) => ({
    message: one(directEmailMessages, {
        fields: [directEmailRecipients.messageId],
        references: [directEmailMessages.id]
    })
}));

/** Type inference helpers. */
export type InsertDirectEmailRecipient = typeof directEmailRecipients.$inferInsert;
export type SelectDirectEmailRecipient = typeof directEmailRecipients.$inferSelect;
