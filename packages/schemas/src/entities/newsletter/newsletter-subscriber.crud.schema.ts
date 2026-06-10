/**
 * @module entities/newsletter/newsletter-subscriber.crud.schema
 *
 * Request body schemas for newsletter subscriber endpoints (SPEC-101).
 *
 * Covers:
 * - `CreateNewsletterSubscriberSchema`         — protected subscribe (body-less; identity from session)
 * - `UnsubscribeNewsletterRequestSchema`       — public unsubscribe via HMAC token
 * - `VerifyNewsletterTokenRequestSchema`       — public double opt-in verification
 * - `ResendVerificationRequestSchema`          — protected resend (body-less)
 * - `UpdateNewsletterPreferencesInputSchema`   — protected per-content-type toggles (PATCH body)
 */

import { z } from 'zod';
import { NewsletterContentPreferencesSchema } from './newsletter-subscriber.schema.js';

// ============================================================================
// CreateNewsletterSubscriberSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/protected/newsletter/subscribe`.
 *
 * The subscriber's email and userId are resolved from the authenticated session,
 * so no body fields are required. `.strict()` rejects any unexpected fields.
 *
 * @example
 * ```ts
 * const body = CreateNewsletterSubscriberSchema.parse({});
 * ```
 */
export const CreateNewsletterSubscriberSchema = z.object({}).strict();

/** TypeScript type inferred from {@link CreateNewsletterSubscriberSchema}. */
export type CreateNewsletterSubscriber = z.infer<typeof CreateNewsletterSubscriberSchema>;

// ============================================================================
// UnsubscribeNewsletterRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/public/newsletter/unsubscribe`.
 *
 * The HMAC token encodes the subscriber identity; the service validates the
 * signature and transitions the subscriber status to UNSUBSCRIBED.
 * `.strict()` rejects any extra fields.
 *
 * @example
 * ```ts
 * const body = UnsubscribeNewsletterRequestSchema.parse({ token: 'abc123...' });
 * ```
 */
export const UnsubscribeNewsletterRequestSchema = z
    .object({
        /** HMAC token from the unsubscribe link embedded in the email footer. */
        token: z.string().min(1, { message: 'zodError.entity.newsletterSubscriber.token.required' })
    })
    .strict();

/** TypeScript type inferred from {@link UnsubscribeNewsletterRequestSchema}. */
export type UnsubscribeNewsletterRequest = z.infer<typeof UnsubscribeNewsletterRequestSchema>;

// ============================================================================
// VerifyNewsletterTokenRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/public/newsletter/verify`.
 *
 * The HMAC token from the double opt-in email link is validated by the service;
 * a successful parse transitions the subscriber from PENDING_VERIFICATION to ACTIVE.
 * `.strict()` rejects any extra fields.
 *
 * @example
 * ```ts
 * const body = VerifyNewsletterTokenRequestSchema.parse({ token: 'abc123...' });
 * ```
 */
export const VerifyNewsletterTokenRequestSchema = z
    .object({
        /** HMAC token from the verification email link. */
        token: z.string().min(1, { message: 'zodError.entity.newsletterSubscriber.token.required' })
    })
    .strict();

/** TypeScript type inferred from {@link VerifyNewsletterTokenRequestSchema}. */
export type VerifyNewsletterTokenRequest = z.infer<typeof VerifyNewsletterTokenRequestSchema>;

// ============================================================================
// ResendVerificationRequestSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/protected/newsletter/resend-verification`.
 *
 * The authenticated session identifies the subscriber; no body fields are
 * required. `.strict()` rejects any unexpected fields.
 *
 * @example
 * ```ts
 * const body = ResendVerificationRequestSchema.parse({});
 * ```
 */
export const ResendVerificationRequestSchema = z.object({}).strict();

/** TypeScript type inferred from {@link ResendVerificationRequestSchema}. */
export type ResendVerificationRequest = z.infer<typeof ResendVerificationRequestSchema>;

// ============================================================================
// UpdateNewsletterPreferencesInputSchema
// ============================================================================

/**
 * Request body for `PATCH /api/v1/protected/newsletter/preferences`.
 *
 * Accepts a partial map of `NewsletterContentTypeEnum` → boolean: the client
 * sends ONLY the keys it wants to flip. Unknown keys are rejected
 * (`.strict()`) and at least one key must be provided so callers can't waste
 * a round-trip on an empty no-op payload.
 *
 * The service merges this partial onto the stored `preferences` JSONB so the
 * other keys retain whatever value they already had.
 *
 * @example
 * ```ts
 * UpdateNewsletterPreferencesInputSchema.parse({ offers: false });
 * // Toggles "offers" off without touching events/guides/productNews.
 * ```
 */
export const UpdateNewsletterPreferencesInputSchema = NewsletterContentPreferencesSchema.partial()
    .strict()
    .refine((value) => Object.keys(value).length > 0, {
        message: 'zodError.entity.newsletterSubscriber.preferences.atLeastOne'
    });

/** TypeScript type inferred from {@link UpdateNewsletterPreferencesInputSchema}. */
export type UpdateNewsletterPreferencesInput = z.infer<
    typeof UpdateNewsletterPreferencesInputSchema
>;
