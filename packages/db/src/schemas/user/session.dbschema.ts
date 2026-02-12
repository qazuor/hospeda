import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './user.dbschema.ts';

/**
 * Better Auth session table.
 * Stores active user sessions with cookie-based authentication.
 * Managed entirely by Better Auth - do not insert/update manually.
 */
export const sessions = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    /** Admin plugin: tracks if this session is an admin impersonating another user */
    impersonatedBy: text('impersonated_by'),
    /** Two-factor plugin: whether session has completed 2FA verification */
    twoFactorVerified: boolean('two_factor_verified')
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id]
    })
}));
