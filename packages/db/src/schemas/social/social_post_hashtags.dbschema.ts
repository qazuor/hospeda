import { relations } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { socialHashtags } from './social_hashtags.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social post hashtags table.
 * Join table linking social posts to individual hashtag catalog entries.
 * `position` controls the render order in the final hashtag block.
 * Composite UNIQUE (social_post_id, hashtag_id) prevents duplicate links.
 */
export const socialPostHashtags = pgTable(
    'social_post_hashtags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        socialPostId: uuid('social_post_id')
            .notNull()
            .references(() => socialPosts.id, { onDelete: 'cascade' }),
        hashtagId: uuid('hashtag_id')
            .notNull()
            .references(() => socialHashtags.id, { onDelete: 'restrict' }),
        /** 0-indexed position in the final hashtag block */
        position: integer('position').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialPostHashtags_postId_hashtagId_idx: uniqueIndex(
            'socialPostHashtags_postId_hashtagId_idx'
        ).on(table.socialPostId, table.hashtagId),
        socialPostHashtags_postId_idx: index('socialPostHashtags_postId_idx').on(
            table.socialPostId
        ),
        socialPostHashtags_hashtagId_idx: index('socialPostHashtags_hashtagId_idx').on(
            table.hashtagId
        )
    })
);

export const socialPostHashtagsRelations = relations(socialPostHashtags, ({ one }) => ({
    post: one(socialPosts, {
        fields: [socialPostHashtags.socialPostId],
        references: [socialPosts.id]
    }),
    hashtag: one(socialHashtags, {
        fields: [socialPostHashtags.hashtagId],
        references: [socialHashtags.id]
    })
}));

export type InsertSocialPostHashtag = typeof socialPostHashtags.$inferInsert;
export type SelectSocialPostHashtag = typeof socialPostHashtags.$inferSelect;
