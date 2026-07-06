import { relations } from 'drizzle-orm';
import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { socialPostMedia } from './social_post_media.dbschema.ts';
import { socialPostTargets } from './social_post_targets.dbschema.ts';

/**
 * Social post target media table.
 * Join table linking a social post target (one platform dispatch) to the
 * subset of the post's media pool (`social_post_media`) that target should
 * publish, with its own per-target display order. The post still owns its
 * full media pool; this table adds per-target scoping on top of it.
 * `position` controls the render order within the target (0-indexed).
 * Composite UNIQUE (social_post_target_id, social_post_media_id) prevents
 * duplicate links.
 */
export const socialPostTargetMedia = pgTable(
    'social_post_target_media',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        socialPostTargetId: uuid('social_post_target_id')
            .notNull()
            .references(() => socialPostTargets.id, { onDelete: 'cascade' }),
        socialPostMediaId: uuid('social_post_media_id')
            .notNull()
            .references(() => socialPostMedia.id, { onDelete: 'cascade' }),
        /** 0-indexed position within the target's media set */
        position: integer('position').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialPostTargetMedia_targetId_mediaId_idx: uniqueIndex(
            'socialPostTargetMedia_targetId_mediaId_idx'
        ).on(table.socialPostTargetId, table.socialPostMediaId),
        socialPostTargetMedia_targetId_idx: index('socialPostTargetMedia_targetId_idx').on(
            table.socialPostTargetId
        ),
        socialPostTargetMedia_mediaId_idx: index('socialPostTargetMedia_mediaId_idx').on(
            table.socialPostMediaId
        )
    })
);

export const socialPostTargetMediaRelations = relations(socialPostTargetMedia, ({ one }) => ({
    target: one(socialPostTargets, {
        fields: [socialPostTargetMedia.socialPostTargetId],
        references: [socialPostTargets.id]
    }),
    media: one(socialPostMedia, {
        fields: [socialPostTargetMedia.socialPostMediaId],
        references: [socialPostMedia.id]
    })
}));

export type InsertSocialPostTargetMedia = typeof socialPostTargetMedia.$inferInsert;
export type SelectSocialPostTargetMedia = typeof socialPostTargetMedia.$inferSelect;
