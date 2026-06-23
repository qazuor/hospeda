import { relations } from 'drizzle-orm';
import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid
} from 'drizzle-orm/pg-core';
import {
    SocialApprovalStatusPgEnum,
    SocialPostStatusPgEnum,
    SocialRecurrenceTypePgEnum,
    SocialSourcePgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { socialAudiences } from './social_audiences.dbschema.ts';
import { socialCampaigns } from './social_campaigns.dbschema.ts';
import { socialContentBatches } from './social_content_batches.dbschema.ts';
import { socialHashtagSets } from './social_hashtag_sets.dbschema.ts';
import { socialPostFooters } from './social_post_footers.dbschema.ts';
import { socialPostHashtags } from './social_post_hashtags.dbschema.ts';
import { socialPostMedia } from './social_post_media.dbschema.ts';
import { socialPostTargets } from './social_post_targets.dbschema.ts';

/**
 * Social posts table.
 * Master record for every social media post in the pipeline, from GPT draft
 * through approval, scheduling, dispatch, and publish.
 * Full entity: supports soft-delete and audit FKs.
 */
export const socialPosts = pgTable(
    'social_posts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Opaque external ID assigned by the GPT at draft creation.
         * UNIQUE — used as an idempotency key to prevent duplicate ingestion.
         */
        draftId: text('draft_id').notNull().unique(),
        title: text('title').notNull(),
        slug: text('slug').notNull().unique(),
        source: SocialSourcePgEnum('source').notNull(),
        /** Content pillar label (e.g. "travel", "gastronomy", "institutional") */
        pillar: text('pillar'),
        /** Optional campaign association */
        campaignId: uuid('campaign_id').references(() => socialCampaigns.id, {
            onDelete: 'set null'
        }),
        /** Optional batch / sprint association */
        batchId: uuid('batch_id').references(() => socialContentBatches.id, {
            onDelete: 'set null'
        }),
        /** Position within the batch for ordering */
        batchPosition: integer('batch_position'),
        /** Optional audience association */
        audienceId: uuid('audience_id').references(() => socialAudiences.id, {
            onDelete: 'set null'
        }),
        /** Optional footer template for this post */
        footerId: uuid('footer_id').references(() => socialPostFooters.id, {
            onDelete: 'set null'
        }),
        /** Optional base hashtag set for this post */
        baseHashtagSetId: uuid('base_hashtag_set_id').references(() => socialHashtagSets.id, {
            onDelete: 'set null'
        }),
        /** Original caption text as submitted by the GPT or admin */
        captionBase: text('caption_base').notNull(),
        /** Final edited caption, ready for publish. Null until admin finalizes. */
        finalCaption: text('final_caption'),
        /** Final hashtag block as a single text string, appended at publish time */
        finalHashtagsText: text('final_hashtags_text'),
        status: SocialPostStatusPgEnum('status').notNull().default('NEEDS_REVIEW'),
        approvalStatus: SocialApprovalStatusPgEnum('approval_status').notNull().default('PENDING'),
        /**
         * When true the dispatch cron skips this post entirely.
         * Only settable by admins via explicit pause/unpause actions.
         */
        paused: boolean('paused').notNull().default(false),
        /** Number of dispatch retries across all targets */
        retryCount: integer('retry_count').notNull().default(0),
        /** UTC timestamp when the post is scheduled to publish */
        scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
        /** IANA timezone string, e.g. "America/Argentina/Buenos_Aires" */
        timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
        recurrenceType: SocialRecurrenceTypePgEnum('recurrence_type').notNull().default('ONCE'),
        /**
         * JSON params for recurrence (e.g. { weekday: "MONDAY" } for WEEKLY).
         * Null when recurrence_type = ONCE.
         */
        recurrenceParamsJson: jsonb('recurrence_params_json').$type<Record<string, unknown>>(),
        /**
         * Next cron pickup time. Set to scheduled_at on schedule, to now() on mark-ready,
         * and recomputed after each successful publish for recurring posts.
         */
        nextRunAt: timestamp('next_run_at', { withTimezone: true }),
        /** Admin-visible notes (rejection reasons, change requests, etc.) */
        notes: text('notes'),
        /** Internal team notes — never sent to GPT or external systems */
        internalNotes: text('internal_notes'),
        /**
         * Raw GPT hashtag suggestions (custom/novel hashtags not in the catalog).
         * Stored for review; admins can promote these to social_hashtags.
         */
        gptHashtagPayloadJson: jsonb('gpt_hashtag_payload_json').$type<string[]>(),
        /** Miscellaneous metadata bag */
        metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
        /** Admin who approved this post. Set at approval time. */
        approvedById: uuid('approved_by_id').references(() => users.id, { onDelete: 'set null' }),
        approvedAt: timestamp('approved_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        socialPosts_draftId_idx: uniqueIndex('socialPosts_draftId_idx').on(table.draftId),
        socialPosts_slug_idx: uniqueIndex('socialPosts_slug_idx').on(table.slug),
        socialPosts_status_idx: index('socialPosts_status_idx').on(table.status),
        socialPosts_approvalStatus_idx: index('socialPosts_approvalStatus_idx').on(
            table.approvalStatus
        ),
        socialPosts_campaignId_idx: index('socialPosts_campaignId_idx').on(table.campaignId),
        socialPosts_batchId_idx: index('socialPosts_batchId_idx').on(table.batchId),
        socialPosts_audienceId_idx: index('socialPosts_audienceId_idx').on(table.audienceId),
        socialPosts_nextRunAt_idx: index('socialPosts_nextRunAt_idx').on(table.nextRunAt),
        socialPosts_deletedAt_idx: index('socialPosts_deletedAt_idx').on(table.deletedAt)
    })
);

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
    campaign: one(socialCampaigns, {
        fields: [socialPosts.campaignId],
        references: [socialCampaigns.id]
    }),
    batch: one(socialContentBatches, {
        fields: [socialPosts.batchId],
        references: [socialContentBatches.id]
    }),
    audience: one(socialAudiences, {
        fields: [socialPosts.audienceId],
        references: [socialAudiences.id]
    }),
    footer: one(socialPostFooters, {
        fields: [socialPosts.footerId],
        references: [socialPostFooters.id]
    }),
    baseHashtagSet: one(socialHashtagSets, {
        fields: [socialPosts.baseHashtagSetId],
        references: [socialHashtagSets.id]
    }),
    approvedBy: one(users, {
        fields: [socialPosts.approvedById],
        references: [users.id],
        relationName: 'socialPostApprovedBy'
    }),
    createdBy: one(users, {
        fields: [socialPosts.createdById],
        references: [users.id],
        relationName: 'socialPostCreatedBy'
    }),
    updatedBy: one(users, {
        fields: [socialPosts.updatedById],
        references: [users.id],
        relationName: 'socialPostUpdatedBy'
    }),
    deletedBy: one(users, {
        fields: [socialPosts.deletedById],
        references: [users.id],
        relationName: 'socialPostDeletedBy'
    }),
    targets: many(socialPostTargets),
    media: many(socialPostMedia),
    hashtags: many(socialPostHashtags)
}));

export type InsertSocialPost = typeof socialPosts.$inferInsert;
export type SelectSocialPost = typeof socialPosts.$inferSelect;
