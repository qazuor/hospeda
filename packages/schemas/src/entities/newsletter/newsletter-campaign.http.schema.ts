/**
 * @module entities/newsletter/newsletter-campaign.http.schema
 *
 * HTTP request/response schemas for newsletter campaign endpoints (SPEC-101).
 */

import { z } from 'zod';

// ============================================================================
// TestSendNewsletterCampaignRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/admin/newsletter/campaigns/:id/test-send`.
 *
 * Sends the campaign as a test to the authenticated admin's own email address.
 * No body fields are required — the recipient is resolved from the session.
 * `.strict()` rejects any unexpected fields.
 *
 * @example
 * ```ts
 * const body = TestSendNewsletterCampaignRequestSchema.parse({});
 * ```
 */
export const TestSendNewsletterCampaignRequestSchema = z.object({}).strict();

/** TypeScript type inferred from {@link TestSendNewsletterCampaignRequestSchema}. */
export type TestSendNewsletterCampaignRequest = z.infer<
    typeof TestSendNewsletterCampaignRequestSchema
>;

// ============================================================================
// SendNewsletterCampaignRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/admin/newsletter/campaigns/:id/send`.
 *
 * Triggers dispatch of a DRAFT campaign to the full subscriber audience.
 * `ignoreSoftCap` bypasses the rolling-window cap that prevents sending a
 * newsletter to the same subscriber more than once per
 * `HOSPEDA_NEWSLETTER_SOFTCAP_DAYS` days. Use with caution.
 * `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * const body = SendNewsletterCampaignRequestSchema.parse({ ignoreSoftCap: false });
 * ```
 */
export const SendNewsletterCampaignRequestSchema = z
    .object({
        /**
         * When `true`, bypasses the soft-cap rolling window and sends to all
         * active subscribers regardless of recent delivery history.
         * Defaults to `false`.
         */
        ignoreSoftCap: z.boolean().optional().default(false)
    })
    .strict();

/** TypeScript type inferred from {@link SendNewsletterCampaignRequestSchema}. */
export type SendNewsletterCampaignRequest = z.infer<typeof SendNewsletterCampaignRequestSchema>;

// ============================================================================
// CancelNewsletterCampaignRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/admin/newsletter/campaigns/:id/cancel`.
 *
 * Cancels a SENDING campaign. Pending delivery rows are flipped to `skipped`.
 * In-flight worker batches may still complete (accepted edge case).
 * No body fields are required. `.strict()` rejects any unexpected fields.
 *
 * @example
 * ```ts
 * const body = CancelNewsletterCampaignRequestSchema.parse({});
 * ```
 */
export const CancelNewsletterCampaignRequestSchema = z.object({}).strict();

/** TypeScript type inferred from {@link CancelNewsletterCampaignRequestSchema}. */
export type CancelNewsletterCampaignRequest = z.infer<typeof CancelNewsletterCampaignRequestSchema>;

// ============================================================================
// NewsletterCampaignMetricsResponseSchema
// ============================================================================

/**
 * Response body for `GET /api/v1/admin/newsletter/campaigns/:id/metrics`.
 *
 * Aggregated delivery metrics for a single campaign.
 * `openRate` and `clickRate` are expressed as percentages (0..100).
 * All other fields are non-negative integers.
 *
 * Open and click counts are populated from Brevo webhook events;
 * they may lag real-time by a few minutes.
 *
 * @example
 * ```ts
 * const metrics = NewsletterCampaignMetricsResponseSchema.parse({
 *   totalRecipients: 1000,
 *   delivered: 980,
 *   failed: 10,
 *   skipped: 10,
 *   opens: 250,
 *   clicks: 80,
 *   openRate: 25.51,
 *   clickRate: 8.16
 * });
 * ```
 */
export const NewsletterCampaignMetricsResponseSchema = z.object({
    /** Total number of delivery rows created at dispatch time. */
    totalRecipients: z.number().int().min(0),

    /** Number of deliveries that reached DELIVERED status. */
    delivered: z.number().int().min(0),

    /** Number of deliveries that reached FAILED status. */
    failed: z.number().int().min(0),

    /** Number of deliveries that reached SKIPPED status (soft-cap or cancellation). */
    skipped: z.number().int().min(0),

    /** Number of deliveries with at least one recorded open event (from Brevo webhook). */
    opens: z.number().int().min(0),

    /** Number of deliveries with at least one recorded click event (from Brevo webhook). */
    clicks: z.number().int().min(0),

    /** Open rate as a percentage (opens / delivered × 100). Range: 0..100. */
    openRate: z.number().min(0).max(100),

    /** Click rate as a percentage (clicks / delivered × 100). Range: 0..100. */
    clickRate: z.number().min(0).max(100)
});

/** TypeScript type inferred from {@link NewsletterCampaignMetricsResponseSchema}. */
export type NewsletterCampaignMetricsResponse = z.infer<
    typeof NewsletterCampaignMetricsResponseSchema
>;
