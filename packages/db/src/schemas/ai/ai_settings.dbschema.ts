import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * AI settings table (SPEC-173 T-004).
 *
 * Admin-managed AI configuration stored as a key→value JSONB blob, mirroring
 * the blessed `platform_settings` pattern exactly (see
 * `packages/db/src/schemas/platform/platform-settings.dbschema.ts`).
 *
 * The canonical key for V1 is `'global'`, which holds the full
 * `AiSettingsValue` object validated by `AiSettingsValueSchema`
 * (`@repo/schemas`). Future per-feature or per-environment overrides can be
 * stored under additional keys without a schema change.
 *
 * Upsert-only — settings are mutated in place. Soft-delete is intentionally
 * omitted: a deleted settings key would be ambiguous with an absent key (both
 * mean "use built-in defaults"), following the same rationale as
 * `platform_settings`.
 */
export const aiSettings = pgTable('ai_settings', {
    /**
     * Stable string key identifying the settings group.
     * E.g. `'global'` for the top-level AI config blob.
     */
    key: varchar('key', { length: 128 }).primaryKey(),

    /**
     * JSONB settings blob.
     * Shape validated at the application layer by `AiSettingsValueSchema`
     * in `@repo/schemas`.
     */
    value: jsonb('value').notNull(),

    /** FK → users.id. SUPER_ADMIN who last updated this settings group. */
    updatedBy: uuid('updated_by')
        .notNull()
        .references(() => users.id),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** Type inference helpers. */
export type InsertAiSettings = typeof aiSettings.$inferInsert;
export type SelectAiSettings = typeof aiSettings.$inferSelect;
