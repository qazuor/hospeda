import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Social settings table.
 * Key-value configuration store for the social automation pipeline
 * (e.g. make_webhook_url, default_timezone, max_hashtags_per_platform).
 *
 * No soft-delete and no audit FKs: this is a small managed table that
 * is updated via explicit admin actions. The semantic audit trail for
 * settings changes lives in social_audit_log (event SETTING_UPDATED).
 */
export const socialSettings = pgTable(
    'social_settings',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Unique setting key, e.g. "make_webhook_url" */
        key: text('key').notNull(),
        /** Setting value — always stored as text; coercion happens in the service */
        value: text('value').notNull(),
        /**
         * Value type hint for the admin UI:
         * "string" | "number" | "boolean" | "json" | "secret"
         */
        type: text('type').notNull().default('string'),
        active: boolean('active').notNull().default(true),
        description: text('description'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialSettings_key_idx: uniqueIndex('socialSettings_key_idx').on(table.key),
        socialSettings_active_idx: index('socialSettings_active_idx').on(table.active)
    })
);

export type InsertSocialSetting = typeof socialSettings.$inferInsert;
export type SelectSocialSetting = typeof socialSettings.$inferSelect;
