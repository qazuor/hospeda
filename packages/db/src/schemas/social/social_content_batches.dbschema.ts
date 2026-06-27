import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social content batches table.
 * Publishing sprint grouping (e.g. "Hospeda Launch 2026-06").
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialContentBatches = pgTable(
    'social_content_batches',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        description: text('description'),
        active: boolean('active').notNull().default(true),
        startsAt: timestamp('starts_at', { withTimezone: true }),
        endsAt: timestamp('ends_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialContentBatches_slug_idx: index('socialContentBatches_slug_idx').on(table.slug),
        socialContentBatches_active_idx: index('socialContentBatches_active_idx').on(table.active),
        socialContentBatches_deletedAt_idx: index('socialContentBatches_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const socialContentBatchesRelations = relations(socialContentBatches, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialContentBatches.createdById],
        references: [users.id],
        relationName: 'socialContentBatchCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialContentBatches.updatedById],
        references: [users.id],
        relationName: 'socialContentBatchUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialContentBatches.deletedById],
        references: [users.id],
        relationName: 'socialContentBatchDeletedBy'
    }),
    posts: many(socialPosts)
}));

export type InsertSocialContentBatch = typeof socialContentBatches.$inferInsert;
export type SelectSocialContentBatch = typeof socialContentBatches.$inferSelect;
