import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Better Auth verification table.
 * Stores email verification tokens, password reset tokens, and other
 * short-lived verification data.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const verifications = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
});
