/**
 * @module entities/newsletter/newsletter-subscriber.http.schema
 *
 * HTTP request/response schemas for newsletter subscriber endpoints (SPEC-101).
 */

import { z } from 'zod';
import { NewsletterSubscriberStatusEnum } from '../../enums/newsletter-subscriber-status.enum.js';

// ============================================================================
// NewsletterSubscriberStatusResponseSchema
// ============================================================================

/**
 * Response body for `GET /api/v1/protected/newsletter/status`.
 *
 * Returns the current subscription state for the authenticated user.
 * `status` is `null` when no subscription row exists for the given channel.
 * Timestamps are ISO-8601 strings when present, `null` otherwise.
 *
 * @example
 * ```ts
 * const body = NewsletterSubscriberStatusResponseSchema.parse(dbRow);
 * // { subscribed: true, status: 'active', subscribedAt: '2025-01-01T00:00:00Z', verifiedAt: '...' }
 * ```
 */
export const NewsletterSubscriberStatusResponseSchema = z.object({
    /** Whether an active (non-deleted) subscription exists for this user + channel. */
    subscribed: z.boolean(),

    /** Current lifecycle status, or `null` when no subscription exists. */
    status: z.nativeEnum(NewsletterSubscriberStatusEnum).nullable(),

    /** ISO-8601 string of when the subscriber row was created, or `null`. */
    subscribedAt: z.string().datetime().nullable(),

    /** ISO-8601 string of when the subscriber verified their email, or `null`. */
    verifiedAt: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link NewsletterSubscriberStatusResponseSchema}. */
export type NewsletterSubscriberStatusResponse = z.infer<
    typeof NewsletterSubscriberStatusResponseSchema
>;

// ============================================================================
// NewsletterSubscribeResponseSchema
// ============================================================================

/**
 * Response body for `POST /api/v1/protected/newsletter/subscribe`.
 *
 * Discriminates three outcomes:
 * - `pending_verification` — new subscription row created; verification email sent.
 * - `active` — subscriber already verified; no action taken.
 * - `already_pending` — unverified duplicate detected; a new verification email was
 *   re-sent if the throttle window allows.
 *
 * @example
 * ```ts
 * const response = NewsletterSubscribeResponseSchema.parse({ status: 'pending_verification' });
 * ```
 */
export const NewsletterSubscribeResponseSchema = z.object({
    /** Outcome discriminator. */
    status: z.enum(['pending_verification', 'active', 'already_pending'])
});

/** TypeScript type inferred from {@link NewsletterSubscribeResponseSchema}. */
export type NewsletterSubscribeResponse = z.infer<typeof NewsletterSubscribeResponseSchema>;

// ============================================================================
// NewsletterGuestSubscribeRequestSchema
// ============================================================================

/** Sources accepted for a guest (unauthenticated) newsletter subscribe request. */
export const NEWSLETTER_GUEST_SUBSCRIBE_SOURCES = ['web_footer', 'web_landing'] as const;

/**
 * Request body for `POST /api/v1/public/newsletter/subscribe` (guest/unauthenticated
 * signup). Exported from `@repo/schemas` (HOS-190 form 23) so the web client
 * validates against the exact same shape the API route enforces — the route
 * imports this schema instead of declaring its own private copy.
 *
 * @example
 * ```ts
 * const result = NewsletterGuestSubscribeRequestSchema.safeParse({
 *   email: 'visitor@example.com',
 *   locale: 'es',
 *   source: 'web_footer'
 * });
 * ```
 */
export const NewsletterGuestSubscribeRequestSchema = z.object({
    /** Email address to subscribe. */
    email: z.string().email().max(255),
    /** UI locale at signup time, used for the verification email copy. */
    locale: z.enum(['es', 'en', 'pt']).optional(),
    /** Where the signup originated. */
    source: z.enum(NEWSLETTER_GUEST_SUBSCRIBE_SOURCES).optional()
});

/** TypeScript type inferred from {@link NewsletterGuestSubscribeRequestSchema}. */
export type NewsletterGuestSubscribeRequest = z.infer<typeof NewsletterGuestSubscribeRequestSchema>;

// ============================================================================
// NewsletterSubscriberStatsResponseSchema
// ============================================================================

/**
 * Response body for `GET /api/v1/admin/newsletter/subscribers/stats`.
 *
 * Aggregated counts per subscriber lifecycle status. All counts are
 * non-negative integers.
 *
 * @example
 * ```ts
 * const stats = NewsletterSubscriberStatsResponseSchema.parse({
 *   totalActive: 1200,
 *   totalPending: 45,
 *   totalUnsubscribed: 300,
 *   totalBounced: 12,
 *   totalComplained: 3
 * });
 * ```
 */
export const NewsletterSubscriberStatsResponseSchema = z.object({
    /** Count of subscribers in ACTIVE status. */
    totalActive: z.number().int().min(0),

    /** Count of subscribers in PENDING_VERIFICATION status. */
    totalPending: z.number().int().min(0),

    /** Count of subscribers in UNSUBSCRIBED status. */
    totalUnsubscribed: z.number().int().min(0),

    /** Count of subscribers in BOUNCED status. */
    totalBounced: z.number().int().min(0),

    /** Count of subscribers in COMPLAINED status. */
    totalComplained: z.number().int().min(0)
});

/** TypeScript type inferred from {@link NewsletterSubscriberStatsResponseSchema}. */
export type NewsletterSubscriberStatsResponse = z.infer<
    typeof NewsletterSubscriberStatsResponseSchema
>;

// ============================================================================
// NewsletterSubscribersByPreferenceSchema
// ============================================================================

/**
 * Response body for `GET /api/v1/admin/newsletter/subscribers/by-preference`.
 *
 * Count of ACTIVE (non-deleted) newsletter subscribers that have each
 * content-preference opt-in flag set to `true` in the JSONB
 * `newsletter_subscribers.preferences` column.
 *
 * Each key maps to a `NewsletterContentTypeEnum` value. The count for a given
 * preference is the number of active subscribers whose `preferences` JSONB
 * contains `{ "<key>": true }`.
 *
 * A subscriber is counted for a preference even if they also have other
 * preferences enabled — the counts are independent (not mutually exclusive).
 *
 * @example
 * ```ts
 * const stats = NewsletterSubscribersByPreferenceSchema.parse({
 *   OFFERS: 980,
 *   EVENTS: 870,
 *   GUIDES: 750,
 *   PRODUCT_NEWS: 620
 * });
 * ```
 */
export const NewsletterSubscribersByPreferenceSchema = z.object({
    /** Subscribers opted in to OFFERS content (promotions, discounts, deals). */
    OFFERS: z.number().int().min(0),

    /** Subscribers opted in to EVENTS content (festivals, cultural agenda). */
    EVENTS: z.number().int().min(0),

    /** Subscribers opted in to GUIDES content (travel guides, itineraries). */
    GUIDES: z.number().int().min(0),

    /** Subscribers opted in to PRODUCT_NEWS content (platform updates, features). */
    PRODUCT_NEWS: z.number().int().min(0)
});

/** TypeScript type inferred from {@link NewsletterSubscribersByPreferenceSchema}. */
export type NewsletterSubscribersByPreference = z.infer<
    typeof NewsletterSubscribersByPreferenceSchema
>;
