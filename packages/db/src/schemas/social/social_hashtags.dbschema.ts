import { relations } from 'drizzle-orm';
import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { SocialPlatformPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialAudiences } from './social_audiences.dbschema.ts';
import { socialPostHashtags } from './social_post_hashtags.dbschema.ts';

/**
 * Social hashtags table.
 * Individual normalized hashtag catalog entries.
 * normalized_hashtag is the UNIQUE key (lowercase, # prefix).
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialHashtags = pgTable(
    'social_hashtags',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Raw hashtag as entered, e.g. "#Playa" */
        hashtag: text('hashtag').notNull(),
        /** Normalized form — always lowercase with # prefix, e.g. "#playa" */
        normalizedHashtag: text('normalized_hashtag').notNull().unique(),
        /** Category label for grouping (e.g. "nature", "travel", "gastronomy") */
        category: text('category').notNull(),
        /** Optional platform restriction — null means applies to all platforms */
        platform: SocialPlatformPgEnum('platform'),
        /** Optional audience association */
        audienceId: uuid('audience_id').references(() => socialAudiences.id, {
            onDelete: 'set null'
        }),
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
        socialHashtags_normalizedHashtag_idx: index('socialHashtags_normalizedHashtag_idx').on(
            table.normalizedHashtag
        ),
        socialHashtags_platform_idx: index('socialHashtags_platform_idx').on(table.platform),
        socialHashtags_audienceId_idx: index('socialHashtags_audienceId_idx').on(table.audienceId),
        socialHashtags_active_idx: index('socialHashtags_active_idx').on(table.active),
        socialHashtags_deletedAt_idx: index('socialHashtags_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialHashtagsRelations = relations(socialHashtags, ({ one, many }) => ({
    audience: one(socialAudiences, {
        fields: [socialHashtags.audienceId],
        references: [socialAudiences.id]
    }),
    createdBy: one(users, {
        fields: [socialHashtags.createdById],
        references: [users.id],
        relationName: 'socialHashtagCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialHashtags.updatedById],
        references: [users.id],
        relationName: 'socialHashtagUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialHashtags.deletedById],
        references: [users.id],
        relationName: 'socialHashtagDeletedBy'
    }),
    postHashtags: many(socialPostHashtags)
}));

export type InsertSocialHashtag = typeof socialHashtags.$inferInsert;
export type SelectSocialHashtag = typeof socialHashtags.$inferSelect;
