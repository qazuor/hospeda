import { relations, sql } from 'drizzle-orm';
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { DirectEmailSuppressionReasonPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Direct email suppression list (HOS-2685).
 *
 * Addresses the admin can no longer send direct emails to: the person opted
 * out through the footer link, the provider reported a hard bounce, or an
 * admin added the address by hand. Independent of the newsletter subscribers.
 */
export const directEmailSuppressions = pgTable(
    'direct_email_suppression',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Suppressed address, lowercased. */
        email: varchar('email', { length: 254 }).notNull(),

        reason: DirectEmailSuppressionReasonPgEnum('reason').notNull(),

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

        /** FK → users.id. NULL for opt-outs and bounces (no admin involved). */
        createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** One row per address, case-insensitive; also the lookup index for the send. */
        direct_email_suppression_email_uidx: uniqueIndex('direct_email_suppression_email_uidx').on(
            sql`lower(${table.email})`
        )
    })
);

/** Drizzle relations for `direct_email_suppression`. */
export const directEmailSuppressionsRelations = relations(directEmailSuppressions, ({ one }) => ({
    creator: one(users, {
        fields: [directEmailSuppressions.createdBy],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertDirectEmailSuppression = typeof directEmailSuppressions.$inferInsert;
export type SelectDirectEmailSuppression = typeof directEmailSuppressions.$inferSelect;
