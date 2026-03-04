import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Billing settings table.
 *
 * Key-value store for billing configuration. Replaces the previous anti-pattern
 * of storing settings as special entries in `billing_audit_logs`.
 *
 * Each row represents a settings group (e.g. key='global' with the complete
 * settings object as the value). The `updatedBy` field links to the user
 * who last modified the settings (nullable for system-initiated changes).
 */
export const billingSettings = pgTable('billing_settings', {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
