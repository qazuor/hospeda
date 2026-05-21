import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import {
    NewsletterCampaignLocaleFilterPgEnum,
    NewsletterCampaignStatusPgEnum,
    NewsletterContentTypePgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Newsletter campaigns table (SPEC-101).
 *
 * A campaign is an admin-authored newsletter edition. `body_json` holds the
 * raw TipTap document JSON; the rendered HTML is computed at send time via
 * the shared renderer in @repo/utils (T-101-23) so web preview and email
 * output stay WYSIWYG-identical.
 *
 * `scheduled_for` is reserved for a future scheduled-send feature (spec §3
 * Out of Scope for MVP); no cron path consumes it yet.
 *
 * The `set_updated_at` trigger (manual SQL 0005) maintains `updated_at`.
 */
export const newsletterCampaigns = pgTable(
    'newsletter_campaigns',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** Internal label — never shown to subscribers. */
        title: varchar('title', { length: 120 }).notNull(),

        /** Email subject line — shown in the recipient's inbox. */
        subject: varchar('subject', { length: 120 }).notNull(),

        /** TipTap document JSON. Rendered to HTML at send time. */
        bodyJson: jsonb('body_json').notNull(),

        /** Lifecycle state. See NewsletterCampaignStatusEnum for transitions. */
        status: NewsletterCampaignStatusPgEnum('status').notNull().default('draft'),

        /** Audience locale filter at dispatch time. */
        localeFilter: NewsletterCampaignLocaleFilterPgEnum('locale_filter')
            .notNull()
            .default('all'),

        /**
         * Audience content-type filter at dispatch time.
         *
         * NULL → no segmentation; the campaign reaches every active subscriber
         * matching the locale filter (legacy behavior, default for back-compat
         * with pre-Phase-6 campaigns).
         *
         * Non-NULL (`offers | events | guides | productNews`) → only subscribers
         * whose `preferences[contentType]` is `true` are eligible. The dispatch
         * service threads this into
         * `NewsletterSubscriberService.getEligibleForCampaign`.
         *
         * KEEP IN SYNC with the `contentType` field on
         * `packages/schemas/src/entities/newsletter/newsletter-campaign.schema.ts`
         * and migration 0028.
         */
        contentType: NewsletterContentTypePgEnum('content_type'),

        /**
         * Number of subscribers enqueued for delivery. Set at dispatch time
         * (status → SENDING). NULL while in DRAFT.
         */
        totalRecipients: integer('total_recipients'),

        /**
         * Number of subscribers excluded by the soft-cap window (1 newsletter
         * per subscriber per HOSPEDA_NEWSLETTER_SOFTCAP_DAYS rolling days).
         */
        totalSoftcapped: integer('total_softcapped').notNull().default(0),

        /** When the admin triggered dispatch. NULL while in DRAFT. */
        sentAt: timestamp('sent_at', { withTimezone: true }),

        /** Reserved for V2 scheduled sends. Unused in MVP. */
        scheduledFor: timestamp('scheduled_for', { withTimezone: true }),

        /** FK → users.id. Admin who created the campaign. */
        createdBy: uuid('created_by')
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),

        // ---- Audit columns ----

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

        /** Soft delete — only DRAFT campaigns may be deleted (enforced at the service layer). */
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Admin list filter + close-campaigns cron query. */
        newsletter_campaigns_status_idx: index('newsletter_campaigns_status_idx').on(table.status),

        /** Admin audit trail: campaigns by author. */
        newsletter_campaigns_created_by_idx: index('newsletter_campaigns_created_by_idx').on(
            table.createdBy
        )
    })
);

/**
 * Drizzle relations for `newsletter_campaigns`.
 *
 * The deliveries side of this relation is wired in T-101-06 when the
 * deliveries table lands. We avoid forward references here.
 */
export const newsletterCampaignsRelations = relations(newsletterCampaigns, ({ one }) => ({
    creator: one(users, {
        fields: [newsletterCampaigns.createdBy],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertNewsletterCampaign = typeof newsletterCampaigns.$inferInsert;
export type SelectNewsletterCampaign = typeof newsletterCampaigns.$inferSelect;
