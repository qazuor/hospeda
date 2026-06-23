import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import {
    SocialPlatformPgEnum,
    SocialPublishFormatPgEnum,
    SocialPublishResultStatusPgEnum
} from '../enums.dbschema.ts';
import { socialPostTargets } from './social_post_targets.dbschema.ts';
import { socialPosts } from './social_posts.dbschema.ts';

/**
 * Social publish logs table.
 * Append-only event log for every dispatch attempt and Make.com callback.
 *
 * NO soft-delete columns and NO audit FKs by design — this is a permanent
 * operational log. Rows are never deleted by application code.
 */
export const socialPublishLogs = pgTable(
    'social_publish_logs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        socialPostId: uuid('social_post_id')
            .notNull()
            .references(() => socialPosts.id, { onDelete: 'cascade' }),
        /** Nullable — absent when logging a post-level event (not target-specific) */
        socialPostTargetId: uuid('social_post_target_id').references(() => socialPostTargets.id, {
            onDelete: 'set null'
        }),
        /** Platform at the time of this log entry. Nullable for post-level events. */
        platform: SocialPlatformPgEnum('platform'),
        /** Publish format at the time of this log entry. Nullable for post-level events. */
        publishFormat: SocialPublishFormatPgEnum('publish_format'),
        status: SocialPublishResultStatusPgEnum('status').notNull(),
        /** Human-readable message describing the event */
        message: text('message'),
        /** Outbound payload sent to Make.com */
        requestPayloadJson: jsonb('request_payload_json').$type<Record<string, unknown>>(),
        /** Response received from Make.com or error detail */
        responsePayloadJson: jsonb('response_payload_json').$type<Record<string, unknown>>(),
        /** Platform's native post ID on success */
        externalPostId: text('external_post_id'),
        /** Platform's native post URL on success */
        externalPostUrl: text('external_post_url'),
        /** Make.com run identifier for correlation */
        makeRunId: text('make_run_id'),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        socialPublishLogs_postId_createdAt_idx: index('socialPublishLogs_postId_createdAt_idx').on(
            table.socialPostId,
            table.createdAt.desc()
        ),
        socialPublishLogs_targetId_idx: index('socialPublishLogs_targetId_idx').on(
            table.socialPostTargetId
        ),
        socialPublishLogs_status_idx: index('socialPublishLogs_status_idx').on(table.status)
    })
);

export const socialPublishLogsRelations = relations(socialPublishLogs, ({ one }) => ({
    post: one(socialPosts, {
        fields: [socialPublishLogs.socialPostId],
        references: [socialPosts.id]
    }),
    target: one(socialPostTargets, {
        fields: [socialPublishLogs.socialPostTargetId],
        references: [socialPostTargets.id]
    })
}));

export type InsertSocialPublishLog = typeof socialPublishLogs.$inferInsert;
export type SelectSocialPublishLog = typeof socialPublishLogs.$inferSelect;
