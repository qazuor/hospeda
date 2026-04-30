/**
 * SPEC-086 T-008 — `r_post_post_tag` join table.
 *
 * Links posts to PostTags (many-to-many).
 * This is a pure editorial join: no per-user attribution (D-001),
 * no audit timestamps. A post can carry multiple PostTags and a
 * PostTag can be assigned to multiple posts.
 *
 * References:
 * - SPEC-086 D-001 (no per-user attribution on PostTag assignments)
 * - SPEC-086 D-018 (final schema shape)
 * - AC-F03
 */
import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { posts } from '../post/post.dbschema.ts';
import { postTags } from './post_tag.dbschema.ts';

/**
 * `r_post_post_tag` — join table that assigns PostTags to posts.
 *
 * Composite PK on (post_id, post_tag_id) guarantees uniqueness of the
 * pair; both columns cascade-delete when the referenced entity is removed.
 * No audit fields — PostTag assignments are editorial, not personal.
 */
export const rPostPostTag = pgTable(
    'r_post_post_tag',
    {
        postId: uuid('post_id')
            .notNull()
            .references(() => posts.id, { onDelete: 'cascade' }),
        postTagId: uuid('post_tag_id')
            .notNull()
            .references(() => postTags.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.postId, table.postTagId] }),
        r_post_post_tag_postId_idx: index('r_post_post_tag_postId_idx').on(table.postId),
        r_post_post_tag_postTagId_idx: index('r_post_post_tag_postTagId_idx').on(table.postTagId)
    })
);

/** Drizzle relations for the r_post_post_tag join table. */
export const rPostPostTagRelations = relations(rPostPostTag, ({ one }) => ({
    post: one(posts, {
        fields: [rPostPostTag.postId],
        references: [posts.id]
    }),
    postTag: one(postTags, {
        fields: [rPostPostTag.postTagId],
        references: [postTags.id]
    })
}));

/**
 * Type for inserting a new r_post_post_tag row.
 * Inferred directly from the schema — do NOT duplicate manually.
 */
export type InsertRPostPostTag = typeof rPostPostTag.$inferInsert;

/**
 * Type for a selected r_post_post_tag row.
 * Inferred directly from the schema — do NOT duplicate manually.
 */
export type SelectRPostPostTag = typeof rPostPostTag.$inferSelect;
