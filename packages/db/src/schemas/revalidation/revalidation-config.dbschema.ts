import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Revalidation configuration table
 * Stores per-entity-type configuration for on-demand ISR revalidation behaviour,
 * including whether automatic revalidation on change is enabled, the cron interval,
 * and the debounce window.
 */
export const revalidationConfig = pgTable('revalidation_config', {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').unique().notNull(),
    autoRevalidateOnChange: boolean('auto_revalidate_on_change').notNull().default(true),
    cronIntervalMinutes: integer('cron_interval_minutes').notNull().default(60),
    debounceSeconds: integer('debounce_seconds').notNull().default(5),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
});
