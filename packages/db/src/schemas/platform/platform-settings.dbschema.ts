import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Platform settings table (SPEC-156).
 *
 * Cross-device storage for SUPER_ADMIN / ADMIN-level platform settings that
 * previously lived in localStorage on a single browser. Stores arbitrary JSON
 * values keyed by a stable string identifier (e.g. 'seo.defaults',
 * 'maintenance.mode', 'announcements.global'). The shape of each value is
 * validated at the application layer by `PlatformSettingsResponseSchema`
 * (discriminated by `key`) in `@repo/schemas`.
 *
 * Upsert-only — settings are mutated in place. Soft delete is intentionally
 * excluded because a deleted setting key would be ambiguous with an absent
 * key (both mean "use built-in defaults").
 */
export const platformSettings = pgTable('platform_settings', {
    key: varchar('key', { length: 128 }).primaryKey(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    updatedBy: uuid('updated_by')
        .notNull()
        .references(() => users.id)
});
