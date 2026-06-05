import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Versioned AI system prompts (SPEC-173 T-004).
 *
 * Each row represents one version of a system prompt for a specific AI feature.
 * Only one row per feature may have `isActive = true`; uniqueness is enforced at
 * the application layer (the engine always selects the active prompt).
 *
 * The `feature` column stores the AI feature identifier (`text_improve`, `chat`,
 * `search`, `support`) as a varchar, matching the `AiFeature` type from
 * `@repo/schemas`. A pgEnum is not used here because the set of valid values is
 * owned by `@repo/schemas` (Zod enum); synchronising a separate DB enum carries
 * migration overhead with no query-time benefit for this table.
 *
 * Decision (owner-approved 2026-06-04): varchar chosen for AI enums (consistent
 * with repo — pgEnum is reserved for TS enums in @repo/schemas; AI values are
 * z.enum). Migrating to pgEnum is a future option if these are ever promoted to
 * TS enums.
 */
export const aiPromptVersions = pgTable(
    'ai_prompt_versions',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * AI feature this prompt belongs to.
         * Values: `text_improve` | `chat` | `search` | `support`
         * (from `AiFeatureSchema` in `@repo/schemas`).
         */
        feature: text('feature').notNull(),

        /**
         * Monotonically increasing version number within a feature.
         * Set by the application layer (max + 1 for the feature).
         */
        version: integer('version').notNull(),

        /** System prompt content (the full prompt string). */
        content: text('content').notNull(),

        /**
         * Whether this version is the currently active prompt for the feature.
         * Only one row per feature should be `true` at a time; the engine picks
         * this row via `isActive = true` and falls back to the in-code default
         * if none exists (§5.6, FR-5).
         */
        isActive: boolean('is_active').notNull().default(false),

        /** FK → users.id. SUPER_ADMIN who authored this version. */
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id),

        // ---- Timestamps ----
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

        // ---- Soft delete ----
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /**
         * Primary lookup: active prompt for a feature.
         * Used by the engine on every AI call to resolve the system prompt.
         */
        aiPromptVersions_feature_active_idx: index('aiPromptVersions_feature_active_idx').on(
            table.feature,
            table.isActive
        ),

        /**
         * History lookup: list all versions for a feature in order.
         * Used by the admin panel to display prompt history.
         */
        aiPromptVersions_feature_version_idx: index('aiPromptVersions_feature_version_idx').on(
            table.feature,
            table.version
        )
    })
);

/** Drizzle relations for `ai_prompt_versions`. */
export const aiPromptVersionsRelations = relations(aiPromptVersions, ({ one }) => ({
    author: one(users, {
        fields: [aiPromptVersions.createdBy],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [aiPromptVersions.deletedById],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertAiPromptVersion = typeof aiPromptVersions.$inferInsert;
export type SelectAiPromptVersion = typeof aiPromptVersions.$inferSelect;
