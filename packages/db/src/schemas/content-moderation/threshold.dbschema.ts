import { relations, sql } from 'drizzle-orm';
import { numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Content moderation thresholds table (SPEC-195).
 *
 * Stores per-context pending/reject thresholds for the moderation engine.
 * v1 ships with a single 'default' row; the schema supports per-context
 * overrides for future use.
 *
 * The cross-column CHECK constraint `pending < reject` lives in
 * `packages/db/src/migrations/extras/012-content-moderation-thresholds.check.sql`
 * (carril 2 — Drizzle cannot emit cross-column checks).
 */
export const contentModerationThresholds = pgTable(
    'content_moderation_thresholds',
    {
        id: uuid('id').defaultRandom().primaryKey(),
        context: text('context').notNull(),
        pending: numeric('pending', { precision: 4, scale: 3, mode: 'number' })
            .notNull()
            .default(0.5),
        reject: numeric('reject', { precision: 4, scale: 3, mode: 'number' })
            .notNull()
            .default(0.85),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (t) => ({
        contextUnique: uniqueIndex('uq_content_moderation_thresholds_context')
            .on(t.context)
            .where(sql`${t.deletedAt} IS NULL`)
    })
);

export const contentModerationThresholdsRelations = relations(
    contentModerationThresholds,
    ({ one }) => ({
        createdBy: one(users, {
            fields: [contentModerationThresholds.createdById],
            references: [users.id]
        }),
        updatedBy: one(users, {
            fields: [contentModerationThresholds.updatedById],
            references: [users.id]
        })
    })
);

export type ContentModerationThreshold = typeof contentModerationThresholds.$inferSelect;
export type NewContentModerationThreshold = typeof contentModerationThresholds.$inferInsert;
