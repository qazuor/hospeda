import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { NewsletterDeliveryStatusPgEnum } from '../enums.dbschema.ts';
import { newsletterCampaigns } from './newsletter_campaigns.dbschema.ts';
import { newsletterSubscribers } from './newsletter_subscribers.dbschema.ts';

/**
 * Newsletter campaign deliveries table (SPEC-101).
 *
 * One row per (campaign, subscriber, channel) representing a single delivery
 * attempt. Rows are immutable on terminal states (`delivered` | `failed` |
 * `skipped`) and are never soft-deleted — see notes on `deletedAt` below.
 *
 * Open/click tracking columns are populated by the Brevo webhook handler,
 * not by us (Brevo handles pixel and link rewrite natively per tech-analysis
 * §1). The webhook handler matches incoming events via `provider_message_id`.
 *
 * Soft-cap enforcement at dispatch time queries this table via
 * `idx_delivery_subscriber_delivered_at` to find recipients who received
 * a newsletter inside the rolling window (default 7 days).
 */
export const newsletterCampaignDeliveries = pgTable(
    'newsletter_campaign_deliveries',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → newsletter_campaigns.id. ON DELETE CASCADE: dropping a campaign drops its delivery history. */
        campaignId: uuid('campaign_id')
            .notNull()
            .references(() => newsletterCampaigns.id, { onDelete: 'cascade' }),

        /** FK → newsletter_subscribers.id. ON DELETE CASCADE for the same reason. */
        subscriberId: uuid('subscriber_id')
            .notNull()
            .references(() => newsletterSubscribers.id, { onDelete: 'cascade' }),

        /**
         * Channel for this delivery row. Always 'email' in MVP; stored as
         * varchar (not the channel enum) because the unique constraint
         * `(campaign_id, subscriber_id, channel)` lives in manual SQL 0023
         * and a varchar is simpler for the partial index expression.
         */
        channel: varchar('channel', { length: 20 }).notNull().default('email'),

        /** Lifecycle state. See NewsletterDeliveryStatusEnum for transitions. */
        status: NewsletterDeliveryStatusPgEnum('status').notNull().default('pending'),

        // ---- Tracking (populated by Brevo webhook, not by us) ----

        /** When Brevo recorded the first open event. NULL if never opened. */
        openedAt: timestamp('opened_at', { withTimezone: true }),

        /** When Brevo recorded the first link click. NULL if never clicked. */
        firstClickAt: timestamp('first_click_at', { withTimezone: true }),

        /** When the dispatch worker confirmed delivery (status → DELIVERED). */
        deliveredAt: timestamp('delivered_at', { withTimezone: true }),

        // ---- Error handling ----

        /** Number of times BullMQ retried this delivery. */
        retryCount: integer('retry_count').notNull().default(0),

        /** Most recent error message from the dispatch worker. NULL on success. */
        errorMessage: text('error_message'),

        /** Brevo message id returned by the batch send. Used by the webhook to match events to deliveries. */
        providerMessageId: varchar('provider_message_id', { length: 255 }),

        // ---- Audit ----

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()

        /**
         * NOTE: no `deletedAt` column. Deliveries are immutable records of
         * what happened. Cancellation is expressed via status='skipped',
         * not via soft delete. Hard delete would lose audit history.
         */
    },
    (table) => ({
        /** Metrics + close-campaign queries: count deliveries by campaign + status. */
        newsletter_deliveries_campaign_status_idx: index(
            'newsletter_deliveries_campaign_status_idx'
        ).on(table.campaignId, table.status),

        /** Soft-cap rolling-window lookup: was this subscriber sent a newsletter recently? */
        newsletter_deliveries_subscriber_delivered_at_idx: index(
            'newsletter_deliveries_subscriber_delivered_at_idx'
        ).on(table.subscriberId, table.deliveredAt),

        /** Brevo webhook lookup by message id. */
        newsletter_deliveries_provider_message_id_idx: index(
            'newsletter_deliveries_provider_message_id_idx'
        ).on(table.providerMessageId)

        /**
         * UNIQUE (campaign_id, subscriber_id, channel) and the partial pending
         * index live in manual SQL:
         *   packages/db/src/migrations/manual/0023_newsletter_delivery_constraints.sql
         * Drizzle cannot express partial indexes, and we want the UNIQUE in
         * the same file for cohesion.
         */
    })
);

/**
 * Drizzle relations for `newsletter_campaign_deliveries`.
 */
export const newsletterCampaignDeliveriesRelations = relations(
    newsletterCampaignDeliveries,
    ({ one }) => ({
        campaign: one(newsletterCampaigns, {
            fields: [newsletterCampaignDeliveries.campaignId],
            references: [newsletterCampaigns.id]
        }),
        subscriber: one(newsletterSubscribers, {
            fields: [newsletterCampaignDeliveries.subscriberId],
            references: [newsletterSubscribers.id]
        })
    })
);

/** Type inference helpers. */
export type InsertNewsletterCampaignDelivery = typeof newsletterCampaignDeliveries.$inferInsert;
export type SelectNewsletterCampaignDelivery = typeof newsletterCampaignDeliveries.$inferSelect;
