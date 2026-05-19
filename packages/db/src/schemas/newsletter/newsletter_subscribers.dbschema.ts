import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import {
    NewsletterChannelPgEnum,
    NewsletterSourcePgEnum,
    NewsletterSubscriberStatusPgEnum
} from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';

/**
 * Newsletter subscribers table (SPEC-101).
 *
 * One row per (user, channel) pair representing a subscription state. MVP only
 * uses `channel='email'`; `whatsapp` is reserved for V2 and may NEVER ship.
 *
 * The double opt-in flow places rows in `PENDING_VERIFICATION` at subscribe
 * time and transitions to `ACTIVE` after the user clicks the HMAC token link.
 *
 * Consent audit columns (`consent_ip`, `consent_ua`) satisfy Ley 25.326 AR /
 * GDPR auditability requirements; do NOT remove them on unsubscribe.
 *
 * Soft delete via `deleted_at` preserves the consent audit trail. The partial
 * unique constraint `UNIQUE (user_id, channel) WHERE deleted_at IS NULL` is
 * declared in manual SQL (0022_newsletter_subscriber_unique_active.sql) because
 * Drizzle cannot express partial unique indexes inline.
 *
 * The `updated_at` column is maintained automatically by the
 * `set_updated_at` trigger defined in:
 *   packages/db/src/migrations/manual/0005_set_updated_at_trigger.sql
 */
export const newsletterSubscribers = pgTable(
    'newsletter_subscribers',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /** FK → users.id. ON DELETE CASCADE: a hard-deleted user takes their subscription with them (consent gone). */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** Recipient email captured at subscribe time. Denormalised so we never have to JOIN users on dispatch. */
        email: varchar('email', { length: 255 }).notNull(),

        /** Delivery channel. MVP: always 'email'. */
        channel: NewsletterChannelPgEnum('channel').notNull().default('email'),

        /** Lifecycle state. See NewsletterSubscriberStatusEnum for transitions. */
        status: NewsletterSubscriberStatusPgEnum('status')
            .notNull()
            .default('pending_verification'),

        /** Locale at subscribe time. Used for dispatch audience segmentation and template selection. */
        locale: varchar('locale', { length: 10 }).notNull().default('es'),

        /** Acquisition source. Used for analytics segmentation. */
        source: NewsletterSourcePgEnum('source').notNull().default('web_footer'),

        // ---- Consent audit (Ley 25.326 AR / GDPR) ----

        /** IP address captured at subscribe time. NULL only for `source='migration'` rows. */
        consentIp: varchar('consent_ip', { length: 45 }),

        /** Full User-Agent header captured at subscribe time. NULL only for `source='migration'` rows. */
        consentUa: text('consent_ua'),

        /** Version label of the consent text shown at subscribe time. Bump when consent copy changes materially. */
        consentVersion: varchar('consent_version', { length: 20 }),

        // ---- Lifecycle timestamps ----

        /** When the row was inserted (before verification). */
        subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow().notNull(),

        /** When status transitioned to `ACTIVE` via HMAC token verification. */
        verifiedAt: timestamp('verified_at', { withTimezone: true }),

        /** When status transitioned to `UNSUBSCRIBED`. */
        unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),

        /** When status transitioned to `BOUNCED` (Brevo hard-bounce webhook). */
        bouncedAt: timestamp('bounced_at', { withTimezone: true }),

        /** When status transitioned to `COMPLAINED` (Brevo spam-complaint webhook). */
        complainedAt: timestamp('complained_at', { withTimezone: true }),

        // ---- Audit columns ----

        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

        /**
         * Soft delete only. Never hard-delete a subscriber row: the consent
         * audit trail must survive. Hard deletion is an admin-only path
         * scoped out of the MVP (SPEC-101 §3 Out of Scope).
         */
        deletedAt: timestamp('deleted_at', { withTimezone: true })
    },
    (table) => ({
        /** Status filter for admin list + dispatch audience selection. */
        newsletter_subscribers_status_idx: index('newsletter_subscribers_status_idx').on(
            table.status
        ),

        /** Locale segmentation at dispatch time. */
        newsletter_subscribers_locale_idx: index('newsletter_subscribers_locale_idx').on(
            table.locale
        ),

        /** Future WhatsApp channel queries; tiny benefit on MVP but cheap to add. */
        newsletter_subscribers_channel_idx: index('newsletter_subscribers_channel_idx').on(
            table.channel
        ),

        /** Brevo webhook handler lookup by email when only the address is in the payload. */
        newsletter_subscribers_email_idx: index('newsletter_subscribers_email_idx').on(table.email)

        /**
         * The partial UNIQUE (user_id, channel) WHERE deleted_at IS NULL is
         * NOT declared here. It lives in manual SQL:
         *   packages/db/src/migrations/manual/0022_newsletter_subscriber_unique_active.sql
         * Drizzle cannot express partial unique indexes inline; the manifest
         * apply-postgres-extras.sh re-applies it after drizzle-kit push.
         */
    })
);

/**
 * Drizzle relations for `newsletter_subscribers`.
 *
 * Campaign deliveries reference subscribers via `subscriberId`; the inverse
 * `many(newsletterCampaignDeliveries)` relation is wired up in T-101-06 when
 * the deliveries table lands. Adding it here would create a forward reference.
 */
export const newsletterSubscribersRelations = relations(newsletterSubscribers, ({ one }) => ({
    user: one(users, {
        fields: [newsletterSubscribers.userId],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
export type SelectNewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
