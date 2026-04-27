/**
 * @module entities/conversation/conversation.relations.schema
 *
 * Relation-enriched schemas for the conversation feature (SPEC-085).
 *
 * Covers:
 * - `MessageWithSenderSchema`         — message row + sender display info (anonymized for guests)
 * - `ConversationWithRelationsSchema` — full conversation + messages + accommodation ref + guest identity
 */

import { z } from 'zod';
import { ConversationSchema } from './conversation.schema.js';
import { MessageSchema } from './message.schema.js';

// ============================================================================
// MessageWithSenderSchema
// ============================================================================

/**
 * Message row extended with sender display information.
 *
 * Guest-facing views anonymize `userId` when the sender is a guest
 * (i.e. `senderType === 'GUEST'`), but always include `senderDisplayName`
 * so the UI can render a label.
 *
 * `senderAvatarUrl` must be a valid URL when present; `null` is accepted to
 * indicate that no avatar is available.
 *
 * @example
 * ```ts
 * const msg = MessageWithSenderSchema.parse({ ...dbRow, senderDisplayName: 'Alice', senderAvatarUrl: null });
 * ```
 */
export const MessageWithSenderSchema = MessageSchema.extend({
    /**
     * Display name shown next to the message bubble.
     * For guests this is the `anonymousName`; for owners it is their profile name.
     */
    senderDisplayName: z.string().min(1),

    /**
     * URL of the sender's avatar image, or `null` when none is available.
     * Must be a valid absolute URL when provided.
     */
    senderAvatarUrl: z.string().url().nullable()
});

/** TypeScript type inferred from {@link MessageWithSenderSchema}. */
export type MessageWithSender = z.infer<typeof MessageWithSenderSchema>;

// ============================================================================
// Sub-schemas used by ConversationWithRelationsSchema
// ============================================================================

/**
 * Minimal accommodation reference included in the conversation relations view.
 *
 * Carries enough data to render a link / label in the UI without exposing the
 * full accommodation record.  `deletedAt` is included so callers can detect
 * soft-deleted accommodations and display a notice.
 */
export const AccommodationRefSchema = z.object({
    /** UUID of the accommodation. */
    id: z.string().uuid(),

    /** URL-friendly slug (e.g. "casa-del-rio"). */
    slug: z.string(),

    /** Human-readable name. */
    name: z.string(),

    /**
     * ISO-8601 soft-delete timestamp, or `null` when the accommodation is active.
     * When non-null, the conversation is read-only.
     */
    deletedAt: z.string().datetime().nullable()
});

/** TypeScript type inferred from {@link AccommodationRefSchema}. */
export type AccommodationRef = z.infer<typeof AccommodationRefSchema>;

/**
 * Guest identity descriptor included in the conversation relations view.
 *
 * For anonymous guests `isAuthenticated` is `false` and `userId` is `null`.
 * For authenticated users `isAuthenticated` is `true` and `userId` is set.
 */
export const GuestIdentitySchema = z.object({
    /** Display name of the guest. */
    displayName: z.string(),

    /** Guest email address. */
    email: z.string().email(),

    /** Whether the guest authenticated via a user session (vs. a magic-link token). */
    isAuthenticated: z.boolean(),

    /**
     * UUID of the authenticated user, or `null` for anonymous guests.
     */
    userId: z.string().uuid().nullable()
});

/** TypeScript type inferred from {@link GuestIdentitySchema}. */
export type GuestIdentity = z.infer<typeof GuestIdentitySchema>;

// ============================================================================
// ConversationWithRelationsSchema
// ============================================================================

/**
 * Full conversation record enriched with related entities.
 *
 * Returned by admin and owner detail endpoints.  Includes:
 * - All base `ConversationSchema` fields
 * - A paginated list of `MessageWithSenderSchema` items
 * - A minimal `AccommodationRefSchema` for the linked accommodation
 * - A `GuestIdentitySchema` describing the guest party
 *
 * @example
 * ```ts
 * const view = ConversationWithRelationsSchema.parse({
 *   ...conversationRow,
 *   messages: [...],
 *   accommodation: { id, slug, name, deletedAt },
 *   guestIdentity: { displayName, email, isAuthenticated, userId }
 * });
 * ```
 */
export const ConversationWithRelationsSchema = ConversationSchema.extend({
    /** Ordered list of messages (oldest first) with sender display info. */
    messages: z.array(MessageWithSenderSchema),

    /** Minimal accommodation reference for link rendering and soft-delete detection. */
    accommodation: AccommodationRefSchema,

    /** Identity of the guest party in the conversation. */
    guestIdentity: GuestIdentitySchema
});

/** TypeScript type inferred from {@link ConversationWithRelationsSchema}. */
export type ConversationWithRelations = z.infer<typeof ConversationWithRelationsSchema>;
