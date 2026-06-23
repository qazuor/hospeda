/**
 * @module entities/conversation/conversation.http.schema
 *
 * API request/response schemas for conversation endpoints (SPEC-085).
 */

import { z } from 'zod';
import type { Conversation } from './conversation.schema.js';
import { ConversationSchema } from './conversation.schema.js';
import type { Message } from './message.schema.js';
import { MessageSchema } from './message.schema.js';

// ============================================================================
// ERROR REASON DISCRIMINATOR
// ============================================================================

/**
 * Canonical set of machine-readable error reason codes for the conversation
 * feature. These codes are returned in error response bodies so that clients
 * can branch on specific failure modes without parsing human-readable messages.
 *
 * Sources: SPEC-085 §UX/Edge Cases, §Conversation State Machine, and
 * §API Surface descriptions.
 */
export const ConversationErrorReasonSchema = z.enum([
    /** The guest access token has been explicitly revoked by an admin. */
    'TOKEN_EXPIRED',

    /** The guest access token has been explicitly revoked by an admin. */
    'TOKEN_REVOKED',

    /** The message body was rejected by the content-moderation layer (blocked word/domain). */
    'MESSAGE_CONTENT_BLOCKED',

    /** The message body exceeds 5000 characters. */
    'MESSAGE_TOO_LONG',

    /**
     * A verified conversation for this (email, accommodationId) pair already exists.
     * The guest should use the existing token link.
     */
    'CONVERSATION_DUPLICATE',

    /** The requested conversation does not exist or the caller has no access to it. */
    'CONVERSATION_NOT_FOUND',

    /**
     * The accommodation linked to this conversation has been soft-deleted.
     * No new messages are accepted; the thread is still readable.
     */
    'ACCOMMODATION_DELETED',

    /** Rate-limit threshold exceeded; `Retry-After` header is set on the response. */
    'RATE_LIMIT_EXCEEDED',

    /**
     * The email-verification JWT has expired (past its 24-hour TTL).
     * Introduced in audit follow-up (AC-002-03).
     */
    'VERIFICATION_TOKEN_EXPIRED',

    /**
     * The email-verification JWT signature is invalid, was not issued by this
     * platform, or the payload is malformed (but is NOT an expiry error).
     * Introduced in audit follow-up (AC-002-04).
     */
    'VERIFICATION_TOKEN_INVALID',

    /**
     * @deprecated Use VERIFICATION_TOKEN_EXPIRED or VERIFICATION_TOKEN_INVALID instead.
     * Kept for backward compatibility with stored/cached error responses.
     *
     * The email-verification JWT signature is invalid, was not issued by this
     * platform, or the payload is malformed.
     */
    'VERIFICATION_INVALID',

    /**
     * The conversation is BLOCKED by the owner or admin.
     * The guest's POST is rejected with a friendly error.
     */
    'CONVERSATION_BLOCKED'
]);

/** TypeScript type inferred from {@link ConversationErrorReasonSchema}. */
export type ConversationErrorReason = z.infer<typeof ConversationErrorReasonSchema>;

// ============================================================================
// ANONYMOUS INITIATION RESPONSE
// ============================================================================

/**
 * Response body for `POST /api/v1/public/conversations/initiate`.
 *
 * Discriminates three outcomes:
 * - `pending_verification` — new conversation created, verification email sent.
 * - `resent` — unverified duplicate detected; verification email re-sent.
 * - `conflict` — verified duplicate detected; guest should use existing token.
 *
 * `conversationId` is present for `pending_verification` and `resent` outcomes.
 */
export const InitiateAnonResponseSchema = z.object({
    /** Outcome discriminator. */
    status: z.enum(['pending_verification', 'resent', 'conflict']),

    /**
     * UUID of the conversation.
     * Present for `pending_verification` and `resent`; absent for `conflict`.
     */
    conversationId: z.string().uuid().optional()
});

/** TypeScript type inferred from {@link InitiateAnonResponseSchema}. */
export type InitiateAnonResponse = z.infer<typeof InitiateAnonResponseSchema>;

// ============================================================================
// AUTHENTICATED INITIATION RESPONSE
// ============================================================================

/**
 * Response body for `POST /api/v1/protected/conversations/initiate`.
 *
 * Always returns the conversation UUID, a flag indicating whether a new
 * conversation was created, and the UUID of the message that was created or
 * appended.
 */
export const InitiateAuthResponseSchema = z.object({
    /** UUID of the conversation (new or existing). */
    conversationId: z.string().uuid(),

    /** `true` when a new conversation was created; `false` when appended. */
    isNew: z.boolean(),

    /** UUID of the newly created message. Always present. */
    messageId: z.string().uuid()
});

/** TypeScript type inferred from {@link InitiateAuthResponseSchema}. */
export type InitiateAuthResponse = z.infer<typeof InitiateAuthResponseSchema>;

// ============================================================================
// THREAD RESPONSE
// ============================================================================

/**
 * Response body for thread GET endpoints.
 */
export const ThreadResponseSchema = z.object({
    /** Full conversation record. */
    conversation: ConversationSchema,

    /**
     * Page of messages in ascending chronological order (oldest first).
     * Defaults to the most recent 50 messages when no cursor is provided.
     */
    messages: z.array(MessageSchema),

    /**
     * Cursor for fetching the preceding (older) page.
     * ISO-8601 timestamp of the oldest message in the current page.
     * `null` when the current page contains the oldest messages in the thread.
     */
    nextCursor: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link ThreadResponseSchema}. */
export type ThreadResponse = z.infer<typeof ThreadResponseSchema>;

// ============================================================================
// ENRICHED THREAD RESPONSES (authenticated owner/guest views)
// ============================================================================
//
// The owner and protected (guest) thread routes return the full conversation
// record PLUS route-level display enrichment that is NOT in the DB row. These
// schemas declare those exact shapes so the fail-closed response pipeline
// (SPEC-210 PR5) can validate without stripping the enrichment fields. They are
// authenticated-tier responses: the goal is to satisfy the pipeline, not to
// hide fields — so the conversation shape is the FULL record, not a narrowed
// public projection.

/**
 * Conversation record enriched for the OWNER thread view.
 *
 * Adds the display fields populated by
 * `apps/api/src/routes/conversations/protected/owner/thread.ts`:
 * - `accommodationName` — accommodation display name (null if deleted)
 * - `guestName` — resolved guest display name (anonymousName or user lookup;
 *   null when unresolved)
 */
export const OwnerThreadConversationSchema = ConversationSchema.extend({
    accommodationName: z.string().nullable(),
    guestName: z.string().nullable()
});

/** TypeScript type inferred from {@link OwnerThreadConversationSchema}. */
export type OwnerThreadConversation = z.infer<typeof OwnerThreadConversationSchema>;

/**
 * Response body for `GET /api/v1/protected/conversations/owner/:id` (owner thread).
 * Wraps the enriched conversation, the message page, and the pagination cursor.
 */
export const OwnerThreadResponseSchema = z.object({
    conversation: OwnerThreadConversationSchema,
    messages: z.array(MessageSchema),
    nextCursor: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link OwnerThreadResponseSchema}. */
export type OwnerThreadResponse = z.infer<typeof OwnerThreadResponseSchema>;

/**
 * Conversation record enriched for the PROTECTED guest thread view.
 *
 * Adds the display fields populated by
 * `apps/api/src/routes/conversations/protected/thread.ts`:
 * - `accommodationName` — accommodation display name (null if deleted)
 * - `accommodationSlug` — accommodation URL slug (null if deleted)
 * - `ownerName` — property owner display/first name (null if owner deleted)
 */
export const ProtectedThreadConversationSchema = ConversationSchema.extend({
    accommodationName: z.string().nullable(),
    accommodationSlug: z.string().nullable(),
    ownerName: z.string().nullable()
});

/** TypeScript type inferred from {@link ProtectedThreadConversationSchema}. */
export type ProtectedThreadConversation = z.infer<typeof ProtectedThreadConversationSchema>;

/**
 * Response body for `GET /api/v1/protected/conversations/:id` (guest thread).
 * Wraps the enriched conversation, the message page, and the pagination cursor.
 */
export const ProtectedThreadResponseSchema = z.object({
    conversation: ProtectedThreadConversationSchema,
    messages: z.array(MessageSchema),
    nextCursor: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link ProtectedThreadResponseSchema}. */
export type ProtectedThreadResponse = z.infer<typeof ProtectedThreadResponseSchema>;

// ============================================================================
// ENRICHED LIST ITEM RESPONSES (authenticated owner/guest list views)
// ============================================================================

/**
 * Single list item for the PROTECTED guest conversation list.
 *
 * Adds the display fields populated per-item by
 * `apps/api/src/routes/conversations/protected/list.ts`:
 * - `accommodationName` — accommodation display name (null if deleted)
 * - `accommodationSlug` — accommodation URL slug (null if deleted)
 * - `lastMessageExcerpt` — first 200 chars of the last message (null if empty)
 * - `unreadCount` — unread message count for the guest side
 */
export const ProtectedConversationListItemSchema = ConversationSchema.extend({
    accommodationName: z.string().nullable(),
    accommodationSlug: z.string().nullable(),
    lastMessageExcerpt: z.string().nullable(),
    unreadCount: z.number().int().min(0)
});

/** TypeScript type inferred from {@link ProtectedConversationListItemSchema}. */
export type ProtectedConversationListItem = z.infer<typeof ProtectedConversationListItemSchema>;

/**
 * Single list item for the OWNER conversation list.
 *
 * Adds the display fields populated per-item by
 * `apps/api/src/routes/conversations/protected/owner/list.ts`:
 * - `accommodationName` — accommodation display name (null if deleted)
 * - `guestName` — resolved guest display name (null when unresolved)
 * - `lastMessageExcerpt` — first 200 chars of the last message (null if empty)
 * - `unreadCount` — unread message count for the owner side
 */
export const OwnerConversationListItemSchema = ConversationSchema.extend({
    accommodationName: z.string().nullable(),
    guestName: z.string().nullable(),
    lastMessageExcerpt: z.string().nullable(),
    unreadCount: z.number().int().min(0)
});

/** TypeScript type inferred from {@link OwnerConversationListItemSchema}. */
export type OwnerConversationListItem = z.infer<typeof OwnerConversationListItemSchema>;

// ============================================================================
// UNREAD COUNT RESPONSE
// ============================================================================

/**
 * Response body for unread-count badge endpoints.
 */
export const UnreadCountResponseSchema = z.object({
    /** Total number of conversations with unread messages for the caller. */
    count: z.number().int().min(0)
});

/** TypeScript type inferred from {@link UnreadCountResponseSchema}. */
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;

// Preserve imported types so consumers can import them from this module.
export type { Conversation, Message };
