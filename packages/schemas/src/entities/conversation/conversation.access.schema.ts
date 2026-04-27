/**
 * @module entities/conversation/conversation.access.schema
 *
 * Access-level schemas for the conversation feature (SPEC-085).
 *
 * Covers:
 * - `AccessTokenSchema`           — DB row mirror for `conversation_access_tokens`
 * - `VerificationTokenPayloadSchema` — JWT payload exchanged during email verification
 * - `RequestAccessSchema`         — body for the "request access link" endpoint
 * - `GuestConversationResponseSchema` — anonymous thread view (conversation + messages)
 */

import { z } from 'zod';
import { MessageSchema } from './message.schema.js';

// ============================================================================
// AccessTokenSchema
// ============================================================================

/**
 * Full DB row mirror for `conversation_access_tokens`.
 *
 * SHA-256 token hashes are stored as 64 hex characters; this schema enforces
 * that constraint via `.length(64)`.
 *
 * @example
 * ```ts
 * const token = AccessTokenSchema.parse(dbRow);
 * ```
 */
export const AccessTokenSchema = z.object({
    /** UUID primary key. */
    id: z.string().uuid(),

    /** Foreign key to `conversations.id`. */
    conversationId: z.string().uuid(),

    /**
     * SHA-256 hash of the raw access token (64 lowercase hex characters).
     * The raw token is never stored.
     */
    tokenHash: z.string().length(64),

    /** ISO-8601 datetime after which the token is no longer valid. */
    expiresAt: z.string().datetime(),

    /** ISO-8601 datetime when the token was revoked, or `null` if still active. */
    revokedAt: z.string().datetime().nullable(),

    /** ISO-8601 datetime when the 15-day reminder was sent, or `null`. */
    day15ReminderSentAt: z.string().datetime().nullable(),

    /** ISO-8601 datetime when the 25-day reminder was sent, or `null`. */
    day25ReminderSentAt: z.string().datetime().nullable(),

    /** ISO-8601 datetime when the row was created. */
    createdAt: z.string().datetime()
});

/** TypeScript type inferred from {@link AccessTokenSchema}. */
export type AccessToken = z.infer<typeof AccessTokenSchema>;

// ============================================================================
// VerificationTokenPayloadSchema
// ============================================================================

/**
 * JWT payload carried inside the email-verification link.
 *
 * The API mints a short-lived JWT (24-hour TTL) containing these two claims.
 * Using `.strict()` ensures that no additional claims can be injected.
 *
 * @example
 * ```ts
 * const payload = VerificationTokenPayloadSchema.parse(jwt.verify(token, secret));
 * ```
 */
export const VerificationTokenPayloadSchema = z
    .object({
        /** UUID of the conversation being verified. */
        conversationId: z.string().uuid(),

        /** Guest email address to verify ownership. */
        email: z.string().email()
    })
    .strict();

/** TypeScript type inferred from {@link VerificationTokenPayloadSchema}. */
export type VerificationTokenPayload = z.infer<typeof VerificationTokenPayloadSchema>;

// ============================================================================
// RequestAccessSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/public/conversations/request-access`.
 *
 * The guest provides only their email address; the API looks up the matching
 * verified conversation and re-sends the magic-link token.
 *
 * `.strict()` is applied to reject any extra fields.
 *
 * @example
 * ```ts
 * const body = RequestAccessSchema.parse(req.json());
 * ```
 */
export const RequestAccessSchema = z
    .object({
        /** Guest email address used to identify the existing conversation. */
        email: z.string().email()
    })
    .strict();

/** TypeScript type inferred from {@link RequestAccessSchema}. */
export type RequestAccess = z.infer<typeof RequestAccessSchema>;

// ============================================================================
// GuestConversationResponseSchema
// ============================================================================

/**
 * Response shape for the anonymous guest thread view.
 *
 * Returned by `GET /api/v1/public/conversations/thread` when the guest
 * authenticates via a magic-link token.  Includes conversation metadata,
 * a paginated list of messages, and soft-delete / archive state.
 *
 * @example
 * ```ts
 * const response = GuestConversationResponseSchema.parse(apiResponse);
 * ```
 */
export const GuestConversationResponseSchema = z.object({
    /** UUID of the conversation. */
    conversationId: z.string().uuid(),

    /** Current conversation lifecycle status string (e.g. "PENDING_OWNER"). */
    status: z.string(),

    /** Human-readable name of the accommodation. */
    accommodationName: z.string(),

    /** UUID of the accommodation. */
    accommodationId: z.string().uuid(),

    /** Display name of the guest (from `anonymousName` or user profile). */
    guestName: z.string(),

    /** Paginated list of messages for the current page. */
    messages: z.array(MessageSchema),

    /**
     * ISO-8601 cursor for fetching the next (older) page of messages.
     * `null` when the current page is the oldest page in the thread.
     */
    nextCursor: z.string().datetime().nullable(),

    /** Whether the guest has archived this conversation. */
    archivedByGuest: z.boolean(),

    /**
     * ISO-8601 timestamp of the last time the guest marked the thread as read.
     * `null` if the guest has never explicitly read the thread.
     */
    lastReadAtByGuest: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link GuestConversationResponseSchema}. */
export type GuestConversationResponse = z.infer<typeof GuestConversationResponseSchema>;
