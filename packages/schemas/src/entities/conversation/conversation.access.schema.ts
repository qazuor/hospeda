/**
 * @module entities/conversation/conversation.access.schema
 *
 * Access-level schemas for the conversation feature (SPEC-085).
 *
 * Covers:
 * - `AccessTokenSchema`               — DB row mirror for `conversation_access_tokens`
 * - `VerificationTokenPayloadSchema`  — JWT payload exchanged during email verification
 * - `RequestAccessSchema`             — body for the "request access link" endpoint
 * - `MessageGuestPublicSchema`        — public message fields safe to return to anonymous guests
 * - `ConversationGuestPublicSchema`   — public conversation fields safe to return to anonymous guests
 * - `GuestThreadResponseSchema`       — full thread response wrapper for guest endpoints (SPEC-210)
 * - `GuestConversationResponseSchema` — anonymous thread view (conversation + messages, legacy)
 */

import { z } from 'zod';
import { ConversationSchema } from './conversation.schema.js';
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
// MessageGuestPublicSchema (SPEC-210)
// ============================================================================

/**
 * Public message fields safe to expose to anonymous guests.
 *
 * Picked from {@link MessageSchema}. Only display-safe fields are included.
 *
 * Included fields:
 * - `id`          — message UUID (needed for list rendering keys and client-side
 *                    cursor tracking)
 * - `body`        — message text content
 * - `senderType`  — distinguishes guest / owner / system messages for styling
 * - `createdAt`   — message timestamp shown to the guest
 *
 * Excluded fields (all audit / internal / PII):
 * - `conversationId` — foreign key, not needed by the guest client
 * - `userId`         — links to the authenticated user, never exposed publicly
 * - `status`         — internal moderation state
 * - `updatedAt`      — internal audit field
 * - `deletedAt`      — soft-delete timestamp, internal only
 * - `createdById`    — audit actor, internal only
 * - `updatedById`    — audit actor, internal only
 * - `deletedById`    — audit actor, internal only
 *
 * @example
 * ```ts
 * const safe = MessageGuestPublicSchema.parse(rawMessageRow);
 * ```
 */
export const MessageGuestPublicSchema = MessageSchema.pick({
    id: true,
    body: true,
    senderType: true,
    createdAt: true
});

/** TypeScript type inferred from {@link MessageGuestPublicSchema}. */
export type MessageGuestPublic = z.infer<typeof MessageGuestPublicSchema>;

// ============================================================================
// ConversationGuestPublicSchema (SPEC-210)
// ============================================================================

/**
 * Public conversation fields safe to expose to anonymous guests.
 *
 * Built by picking safe fields from {@link ConversationSchema} and extending
 * with route-enriched display fields that are NOT in the DB row
 * (`accommodationName`, `accommodationSlug`, `ownerName`).
 *
 * Included fields from ConversationSchema:
 * - `id`                — conversation UUID
 * - `status`            — lifecycle status (PENDING_OWNER, OPEN, CLOSED, etc.)
 * - `accommodationId`   — FK to accommodation (guest already knows this from the
 *                          initiation flow; needed to link back to the listing)
 * - `lastReadAtByOwner` — lets the guest see if the owner has read the thread
 * - `createdAt`         — conversation creation date shown in the thread header
 *
 * Route-enriched fields (added by the guest-thread handler, not in DB row):
 * - `accommodationName` — display name of the accommodation (nullable: null if
 *                          the accommodation was deleted after conversation start)
 * - `accommodationSlug` — URL slug of the accommodation (nullable: same reason)
 * - `ownerName`         — display / first name of the property owner (nullable:
 *                          null if the owner account was deleted)
 *
 * Excluded fields (all PII / internal / audit):
 * - `anonymousEmail`          — guest PII, must never be returned publicly
 * - `anonymousPhone`          — guest PII, must never be returned publicly
 * - `anonymousEmailVerified`  — internal verification flag
 * - `userId`                  — links to authenticated user record
 * - `anonymousName`           — the guest's own name; not exposed in this
 *                               response (unrelated to `ownerName`, which is the
 *                               accommodation owner's display name)
 * - `blockReason`             — internal moderation detail
 * - `blockedAt`               — internal moderation timestamp
 * - `archivedByOwner`         — owner-private archive state
 * - `archivedByGuest`         — internal archive state (not needed by guest view)
 * - `lastReadAtByGuest`       — internal tracking; the route updates it on load
 * - `closedAt`                — internal lifecycle timestamp
 * - `locale`                  — internal locale preference
 * - `firstGuestMessageAt`     — internal analytics timestamp
 * - `firstOwnerReplyAt`       — internal analytics timestamp
 * - `lastActivityAt`          — internal analytics timestamp
 * - `lastGuestMessageAt`      — internal analytics timestamp
 * - `lastOwnerMessageAt`      — internal analytics timestamp
 * - `guestMessageCount`       — internal counter
 * - `ownerMessageCount`       — internal counter
 * - `updatedAt`               — audit field
 * - `deletedAt`               — soft-delete timestamp
 * - `createdById`             — audit actor
 * - `updatedById`             — audit actor
 * - `deletedById`             — audit actor
 *
 * @example
 * ```ts
 * const safe = ConversationGuestPublicSchema.parse({ ...rawRow, accommodationName, ownerName, accommodationSlug });
 * ```
 */
export const ConversationGuestPublicSchema = ConversationSchema.pick({
    id: true,
    status: true,
    accommodationId: true,
    lastReadAtByOwner: true,
    createdAt: true
}).extend({
    /**
     * Display name of the accommodation.
     * Populated by the route via an `AccommodationModel.findById` lookup.
     * Nullable because the accommodation may have been deleted after the
     * conversation was started.
     */
    accommodationName: z.string().nullable(),

    /**
     * URL slug of the accommodation.
     * Populated by the route via an `AccommodationModel.findById` lookup.
     * Nullable for the same reason as `accommodationName`.
     */
    accommodationSlug: z.string().nullable(),

    /**
     * Display name of the property owner (displayName ?? firstName).
     * Populated by the route via a `UserModel.findById` lookup on the
     * accommodation's `ownerId`.
     * Nullable because the owner account may have been deleted.
     */
    ownerName: z.string().nullable()
});

/** TypeScript type inferred from {@link ConversationGuestPublicSchema}. */
export type ConversationGuestPublic = z.infer<typeof ConversationGuestPublicSchema>;

// ============================================================================
// GuestThreadResponseSchema (SPEC-210)
// ============================================================================

/**
 * Full response wrapper returned by `GET /api/v1/public/conversations/guest/:token`.
 *
 * Wraps the public conversation snapshot, the current page of public messages,
 * and the cursor-pagination `hasMore` flag. The route also uses this schema to
 * strip all internal fields before serializing the HTTP response.
 *
 * @example
 * ```ts
 * const response = GuestThreadResponseSchema.parse({ conversation, messages, hasMore });
 * ```
 */
export const GuestThreadResponseSchema = z.object({
    /** Public conversation snapshot — display-safe fields only. */
    conversation: ConversationGuestPublicSchema,

    /** Current page of messages — display-safe fields only. */
    messages: z.array(MessageGuestPublicSchema),

    /**
     * `true` when older messages exist beyond the current page.
     * The web client uses this to render the "load older" link.
     */
    hasMore: z.boolean()
});

/** TypeScript type inferred from {@link GuestThreadResponseSchema}. */
export type GuestThreadResponse = z.infer<typeof GuestThreadResponseSchema>;

// ============================================================================
// GuestConversationResponseSchema (legacy — superseded by GuestThreadResponseSchema)
// ============================================================================

/**
 * Response shape for the anonymous guest thread view.
 *
 * Returned by `GET /api/v1/public/conversations/thread` when the guest
 * authenticates via a magic-link token. Includes conversation metadata,
 * a paginated list of messages, and soft-delete / archive state.
 *
 * @deprecated Superseded by {@link GuestThreadResponseSchema} (SPEC-210).
 * Retained because it is still imported in the schemas test suite
 * (`packages/schemas/test/entities/conversation/conversation.access.schema.test.ts`).
 * Remove once those tests are migrated.
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
