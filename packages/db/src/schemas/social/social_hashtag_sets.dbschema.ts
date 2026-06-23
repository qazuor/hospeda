import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SocialPlatformPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social hashtag sets table.
 * Named collections of hashtags used as base sets for posts.
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialHashtagSets = pgTable(
    'social_hashtag_sets',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        /** Optional platform restriction — null means applies to all platforms */
        platform: SocialPlatformPgEnum('platform'),
        /** Space-separated hashtag string, e.g. "#playa #verano #hospeda" */
        hashtagsText: text('hashtags_text').notNull(),
        priority: integer('priority').notNull().default(0),
        active: boolean('active').notNull().default(true),
        notes: text('notes'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialHashtagSets_slug_idx: index('socialHashtagSets_slug_idx').on(table.slug),
        socialHashtagSets_platform_idx: index('socialHashtagSets_platform_idx').on(table.platform),
        socialHashtagSets_active_idx: index('socialHashtagSets_active_idx').on(table.active),
        socialHashtagSets_deletedAt_idx: index('socialHashtagSets_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const socialHashtagSetsRelations = relations(socialHashtagSets, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialHashtagSets.createdById],
        references: [users.id],
        relationName: 'socialHashtagSetCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialHashtagSets.updatedById],
        references: [users.id],
        relationName: 'socialHashtagSetUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialHashtagSets.deletedById],
        references: [users.id],
        relationName: 'socialHashtagSetDeletedBy'
    }),
    posts: many(socialPosts)
}));

export type InsertSocialHashtagSet = typeof socialHashtagSets.$inferInsert;
export type SelectSocialHashtagSet = typeof socialHashtagSets.$inferSelect;
