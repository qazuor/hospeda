import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import {
    SocialMediaTypePgEnum,
    SocialPlatformPgEnum,
    SocialPublishFormatPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialPostTargets } from './social_post_targets.dbschema.ts';

/**
 * Social platform formats table.
 * Per platform × format configuration row (e.g. INSTAGRAM × FEED_POST).
 * Composite UNIQUE on (platform, publish_format) enforces one row per combo.
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialPlatformFormats = pgTable(
    'social_platform_formats',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        platform: SocialPlatformPgEnum('platform').notNull(),
        publishFormat: SocialPublishFormatPgEnum('publish_format').notNull(),
        mediaType: SocialMediaTypePgEnum('media_type').notNull(),
        enabled: boolean('enabled').notNull().default(true),
        mvpEnabled: boolean('mvp_enabled').notNull().default(false),
        /** Aspect ratio recommendation, e.g. "1:1", "9:16" */
        recommendedRatio: text('recommended_ratio'),
        /** Pixel dimensions recommendation, e.g. "1080x1080" */
        recommendedSize: text('recommended_size'),
        /** Maximum caption length in characters (platform limit) */
        maxCaptionLength: integer('max_caption_length'),
        /** Whether this format requires a reachable public URL for the media */
        requiresPublicUrl: boolean('requires_public_url').notNull().default(false),
        /** Whether this format requires at least one media asset */
        requiresMedia: boolean('requires_media').notNull().default(false),
        /** Make.com scenario channel key for routing dispatch (e.g. "instagram-feed") */
        makeChannelKey: text('make_channel_key'),
        notes: text('notes'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialPlatformFormats_platform_publishFormat_idx: uniqueIndex(
            'socialPlatformFormats_platform_publishFormat_idx'
        ).on(table.platform, table.publishFormat),
        socialPlatformFormats_enabled_idx: index('socialPlatformFormats_enabled_idx').on(
            table.enabled
        ),
        socialPlatformFormats_mvpEnabled_idx: index('socialPlatformFormats_mvpEnabled_idx').on(
            table.mvpEnabled
        ),
        socialPlatformFormats_deletedAt_idx: index('socialPlatformFormats_deletedAt_idx').on(
            table.deletedAt
        )
    })
);

export const socialPlatformFormatsRelations = relations(socialPlatformFormats, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [socialPlatformFormats.createdById],
        references: [users.id],
        relationName: 'socialPlatformFormatCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialPlatformFormats.updatedById],
        references: [users.id],
        relationName: 'socialPlatformFormatUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialPlatformFormats.deletedById],
        references: [users.id],
        relationName: 'socialPlatformFormatDeletedBy'
    }),
    targets: many(socialPostTargets)
}));

export type InsertSocialPlatformFormat = typeof socialPlatformFormats.$inferInsert;
export type SelectSocialPlatformFormat = typeof socialPlatformFormats.$inferSelect;
