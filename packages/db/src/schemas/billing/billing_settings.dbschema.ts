import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

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
export const billingSettings = pgTable(
    'billing_settings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        key: varchar('key', { length: 100 }).notNull().unique(),
        value: jsonb('value').$type<Record<string, unknown>>().notNull(),
        updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        billingSettings_updatedBy_idx: index('billingSettings_updatedBy_idx').on(table.updatedBy)
    })
);
