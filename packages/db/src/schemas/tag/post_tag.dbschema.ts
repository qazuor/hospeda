/**
 * PostTag subsystem — `post_tags` table.
 *
 * Public, SEO-driven content taxonomy for blog post categorization.
 * Slugs appear in public URLs (e.g. `/blog?tag=gastronomia`).
 *
 * This is a completely separate subsystem from the user-tag `tags` table.
 * See SPEC-086 D-001 and D-018 for the architectural rationale.
 *
 * References:
 * - SPEC-086 D-001 (two separate subsystems)
 * - SPEC-086 D-013 (admin endpoints + public read)
 * - SPEC-086 D-018 (final schema shape)
 * - AC-F13
 */
import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum, TagColorPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * `post_tags` — public taxonomy entries for blog post categorization.
 *
 * Each row represents a single editorial tag managed by admins.
 * Tags are publicly readable and their slugs appear in canonical URLs.
 */
export const postTags = pgTable(
    'post_tags',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Human-readable label shown in the UI and public tag pages. Must be unique. */
        name: text('name').notNull(),

        /** URL-safe slug used in public routes (e.g. `/blog?tag=guia-de-viaje`). Must be unique. */
        slug: text('slug').notNull(),

        /** Display color token for the tag badge. */
        color: TagColorPgEnum('color').notNull(),

        /** Optional icon identifier (e.g. Phosphor icon name). */
        icon: text('icon'),

        /** Optional editorial description of the tag's purpose or scope. */
        description: text('description'),

        /**
         * Lifecycle state controls public visibility.
         * Only `ACTIVE` tags appear in public listings (D-013).
         */
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),

        // ── Audit fields ──────────────────────────────────────────────────────
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Unique index — tag names must be globally unique. */
        post_tags_name_idx: uniqueIndex('post_tags_name_idx').on(table.name),

        /** Unique index — slugs must be globally unique for URL routing. */
        post_tags_slug_idx: uniqueIndex('post_tags_slug_idx').on(table.slug),

        /** Non-unique index to support filtering by lifecycle state in admin list views. */
        post_tags_lifecycle_idx: index('post_tags_lifecycle_idx').on(table.lifecycleState)
    })
);

/** Drizzle relations for the PostTag subsystem. */
export const postTagsRelations = relations(postTags, ({ one }) => ({
    createdBy: one(users, {
        fields: [postTags.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [postTags.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [postTags.deletedById],
        references: [users.id]
    })
}));

/**
 * Type for inserting a new PostTag row.
 * Inferred directly from the schema — do NOT duplicate manually.
 */
export type InsertPostTag = typeof postTags.$inferInsert;

/**
 * Type for a selected PostTag row.
 * Inferred directly from the schema — do NOT duplicate manually.
 */
export type SelectPostTag = typeof postTags.$inferSelect;
