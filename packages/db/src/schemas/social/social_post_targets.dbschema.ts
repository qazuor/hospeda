import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    SocialMediaTypePgEnum,
    SocialPlatformPgEnum,
    SocialPostStatusPgEnum,
    SocialPublishFormatPgEnum
} from '../enums.dbschema.ts';
import { socialPlatformFormats } from './social_platform_formats.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';
import { socialPublishLogs } from './social_publish_logs.dbschema.ts';

/**
 * Social post targets table.
 * One row per platform the post should be published to.
 * Holds per-target overrides, Make.com dispatch state, and publish results.
 */
export const socialPostTargets = pgTable(
    'social_post_targets',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        socialPostId: uuid('social_post_id')
            .notNull()
            .references(() => socialPosts.id, { onDelete: 'cascade' }),
        /** Platform-format config row this target maps to */
        platformFormatId: uuid('platform_format_id')
            .notNull()
            .references(() => socialPlatformFormats.id, { onDelete: 'restrict' }),
        platform: SocialPlatformPgEnum('platform').notNull(),
        publishFormat: SocialPublishFormatPgEnum('publish_format').notNull(),
        mediaType: SocialMediaTypePgEnum('media_type').notNull(),
        /** Per-target caption override. Null means use parent post's finalCaption. */
        captionOverride: text('caption_override'),
        /** Per-target hashtag block override. Null means use parent finalHashtagsText. */
        hashtagsOverrideText: text('hashtags_override_text'),
        /** Per-target footer override. Null means use parent post's footer. */
        footerOverride: text('footer_override'),
        /**
         * Target-level status mirrors the post pipeline but is tracked independently
         * so each platform can be in a different state (e.g. PUBLISHED on IG, FAILED on FB).
         */
        status: SocialPostStatusPgEnum('status').notNull().default('NEEDS_REVIEW'),
        scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        /** Platform's native post identifier after successful publish */
        externalPostId: text('external_post_id'),
        /** Platform's native post URL after successful publish */
        externalPostUrl: text('external_post_url'),
        /** Make.com scenario key used for this target's dispatch (from platform_formats) */
        makeScenarioKey: text('make_scenario_key'),
        /** ID of the last Make.com run that claimed this target */
        makeLastRunId: text('make_last_run_id'),
        /** Full payload sent to Make.com for this target */
        makePayloadJson: jsonb('make_payload_json').$type<Record<string, unknown>>(),
        /** Last error message from Make callback or network failure */
        lastErrorMessage: text('last_error_message'),
        /** Number of dispatch retries for this specific target */
        retryCount: integer('retry_count').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialPostTargets_socialPostId_idx: index('socialPostTargets_socialPostId_idx').on(
            table.socialPostId
        ),
        socialPostTargets_platformFormatId_idx: index('socialPostTargets_platformFormatId_idx').on(
            table.platformFormatId
        ),
        socialPostTargets_status_idx: index('socialPostTargets_status_idx').on(table.status),
        socialPostTargets_platform_idx: index('socialPostTargets_platform_idx').on(table.platform)
    })
);

export const socialPostTargetsRelations = relations(socialPostTargets, ({ one, many }) => ({
    post: one(socialPosts, {
        fields: [socialPostTargets.socialPostId],
        references: [socialPosts.id]
    }),
    platformFormat: one(socialPlatformFormats, {
        fields: [socialPostTargets.platformFormatId],
        references: [socialPlatformFormats.id]
    }),
    publishLogs: many(socialPublishLogs)
}));

export type InsertSocialPostTarget = typeof socialPostTargets.$inferInsert;
export type SelectSocialPostTarget = typeof socialPostTargets.$inferSelect;
