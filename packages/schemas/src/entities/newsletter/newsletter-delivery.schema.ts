/**
 * @module entities/newsletter/newsletter-delivery.schema
 *
 * Base Zod schema for the `newsletter_campaign_deliveries` entity (SPEC-101).
 */

import { z } from 'zod';
import { NewsletterDeliveryStatusEnum } from '../../enums/newsletter-delivery-status.enum.js';

/**
 * Core newsletter campaign delivery schema — mirrors the
 * `newsletter_campaign_deliveries` DB table.
 *
 * One row per (campaign, subscriber, channel) delivery attempt. Rows are
 * immutable on terminal states (delivered | failed | skipped).
 *
 * The `channel` field is typed as `z.string()` (not the enum) because the DB
 * column is `varchar(20)` — the partial UNIQUE constraint
 * `(campaign_id, subscriber_id, channel)` in manual SQL 0023 relies on a
 * plain varchar for its expression, and the Drizzle schema intentionally
 * avoids the PG enum here.
 *
 * Open and click tracking fields are populated by the Brevo webhook handler,
 * not by the dispatch worker.
 *
 * @example
 * ```ts
 * const delivery = NewsletterDeliverySchema.parse(row);
 * ```
 */
export const NewsletterDeliverySchema = z.object({
    id: z.string().uuid(),

    /** FK → newsletter_campaigns.id. */
    campaignId: z.string().uuid(),

    /** FK → newsletter_subscribers.id. */
    subscriberId: z.string().uuid(),

    /**
     * Delivery channel — stored as varchar(20) in the DB, not as the channel
     * enum, per the manual-SQL constraint design. MVP value is always 'email'.
     */
    channel: z.string().max(20, { message: 'zodError.entity.newsletterDelivery.channel.max' }),

    /** Lifecycle state. */
    status: z.nativeEnum(NewsletterDeliveryStatusEnum),

    // ---- Tracking (populated by Brevo webhook) ----

    /** When Brevo recorded the first open event. NULL if never opened. */
    openedAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** When Brevo recorded the first link click. NULL if never clicked. */
    firstClickAt: z.union([z.string().datetime(), z.date()]).nullable(),

    /** When the dispatch worker confirmed delivery (status → DELIVERED). */
    deliveredAt: z.union([z.string().datetime(), z.date()]).nullable(),

    // ---- Error handling ----

    /** Number of times BullMQ retried this delivery. */
    retryCount: z.number().int().min(0),

    /** Most recent error message from the dispatch worker. NULL on success. */
    errorMessage: z.string().nullable(),

    /**
     * Brevo message id returned by the batch send.
     * Used by the webhook handler to match events to delivery rows.
     */
    providerMessageId: z
        .string()
        .max(255, { message: 'zodError.entity.newsletterDelivery.providerMessageId.max' })
        .nullable(),

    // ---- Audit ----

    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()])

    // No deletedAt — delivery rows are immutable audit records. Cancellation
    // is expressed via status='skipped', not via soft delete.
});

/** TypeScript type inferred from {@link NewsletterDeliverySchema}. */
export type NewsletterDelivery = z.infer<typeof NewsletterDeliverySchema>;
