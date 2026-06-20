import { relations } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { socialAssets } from './social_assets.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social post media table.
 * Join table linking social posts to their Cloudinary-hosted assets.
 * `position` determines the display/carousel order (0-indexed).
 * Composite UNIQUE (social_post_id, position) prevents duplicate positions.
 */
export const socialPostMedia = pgTable(
    'social_post_media',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        socialPostId: uuid('social_post_id')
            .notNull()
            .references(() => socialPosts.id, { onDelete: 'cascade' }),
        assetId: uuid('asset_id')
            .notNull()
            .references(() => socialAssets.id, { onDelete: 'restrict' }),
        /** 0-indexed display order within the post (carousel position) */
        position: integer('position').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialPostMedia_postId_position_idx: uniqueIndex('socialPostMedia_postId_position_idx').on(
            table.socialPostId,
            table.position
        ),
        socialPostMedia_postId_idx: index('socialPostMedia_postId_idx').on(table.socialPostId),
        socialPostMedia_assetId_idx: index('socialPostMedia_assetId_idx').on(table.assetId)
    })
);

export const socialPostMediaRelations = relations(socialPostMedia, ({ one }) => ({
    post: one(socialPosts, {
        fields: [socialPostMedia.socialPostId],
        references: [socialPosts.id]
    }),
    asset: one(socialAssets, {
        fields: [socialPostMedia.assetId],
        references: [socialAssets.id]
    })
}));

export type InsertSocialPostMedia = typeof socialPostMedia.$inferInsert;
export type SelectSocialPostMedia = typeof socialPostMedia.$inferSelect;
