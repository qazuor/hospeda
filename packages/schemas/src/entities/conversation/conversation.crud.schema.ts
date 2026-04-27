/**
 * @module entities/conversation/conversation.crud.schema
 *
 * Create / Update / Action schemas for the conversation feature (SPEC-085).
 *
 * Covers:
 * - `CreateConversationAnonSchema`    — anonymous guest initiates a conversation
 * - `CreateConversationAuthSchema`    — authenticated user initiates a conversation
 * - `UpdateConversationStatusSchema`  — owner / admin changes conversation status
 * - `ArchiveConversationSchema`       — guest or owner archives a conversation
 * - `CreateMessageSchema`             — any party sends a new message
 */

import { z } from 'zod';
import { ConversationStatusEnum } from '../../enums/conversation-status.enum.js';

// ============================================================================
// CreateConversationAnonSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/public/conversations/initiate` (anonymous guest).
 *
 * Requires the accommodation UUID, the guest's display name and email, plus the
 * opening message.  `guestPhone` and `locale` are optional.  `.strict()` rejects
 * any unknown fields.
 *
 * @example
 * ```ts
 * const body = CreateConversationAnonSchema.parse(req.json());
 * ```
 */
export const CreateConversationAnonSchema = z
    .object({
        /** UUID of the accommodation the guest is enquiring about. */
        accommodationId: z.string().uuid(),

        /** Guest's full display name (1..255 characters). */
        guestName: z.string().min(1).max(255),

        /** Guest's email address — used for email verification. */
        guestEmail: z.string().email(),

        /** Optional guest phone number. */
        guestPhone: z.string().max(50).optional(),

        /** Opening message from the guest (1..5000 characters). */
        message: z.string().min(1).max(5000),

        /** Preferred locale for system notifications (e.g. "es", "en", "pt"). */
        locale: z.string().max(10).optional()
    })
    .strict();

/** TypeScript type inferred from {@link CreateConversationAnonSchema}. */
export type CreateConversationAnon = z.infer<typeof CreateConversationAnonSchema>;

// ============================================================================
// CreateConversationAuthSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/protected/conversations/initiate` (authenticated user).
 *
 * The authenticated caller's identity is resolved from the session, so the body
 * only needs the accommodation UUID and the opening message.  `.strict()` rejects
 * any extra guest-identity fields.
 *
 * @example
 * ```ts
 * const body = CreateConversationAuthSchema.parse(req.json());
 * ```
 */
export const CreateConversationAuthSchema = z
    .object({
        /** UUID of the accommodation the user is enquiring about. */
        accommodationId: z.string().uuid(),

        /** Opening message (1..5000 characters). */
        message: z.string().min(1).max(5000),

        /** Preferred locale for system notifications (e.g. "es", "en", "pt"). */
        locale: z.string().max(10).optional()
    })
    .strict();

/** TypeScript type inferred from {@link CreateConversationAuthSchema}. */
export type CreateConversationAuth = z.infer<typeof CreateConversationAuthSchema>;

// ============================================================================
// UpdateConversationStatusSchema
// ============================================================================

/**
 * Request body for `PATCH /api/v1/.../conversations/:id/status`.
 *
 * When `status` is `BLOCKED`, `blockReason` is required (enforced via `.refine()`).
 * `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * // Valid — BLOCKED with reason
 * const body = UpdateConversationStatusSchema.parse({
 *   status: ConversationStatusEnum.BLOCKED,
 *   blockReason: 'Abusive content'
 * });
 *
 * // Valid — CLOSED without reason
 * const body = UpdateConversationStatusSchema.parse({
 *   status: ConversationStatusEnum.CLOSED
 * });
 * ```
 */
export const UpdateConversationStatusSchema = z
    .object({
        /** Target lifecycle status. */
        status: z.nativeEnum(ConversationStatusEnum),

        /** Required when `status` is `BLOCKED`; explains the reason for blocking. */
        blockReason: z.string().min(1).max(1000).optional()
    })
    .strict()
    .refine(
        (data) => {
            if (data.status === ConversationStatusEnum.BLOCKED) {
                return data.blockReason !== undefined && data.blockReason.length > 0;
            }
            return true;
        },
        {
            message: 'blockReason is required when status is BLOCKED',
            path: ['blockReason']
        }
    );

/** TypeScript type inferred from {@link UpdateConversationStatusSchema}. */
export type UpdateConversationStatus = z.infer<typeof UpdateConversationStatusSchema>;

// ============================================================================
// ArchiveConversationSchema
// ============================================================================

/**
 * Request body for `PATCH /api/v1/.../conversations/:id/archive`.
 *
 * A boolean toggle — `true` archives the conversation, `false` un-archives it.
 * `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * const body = ArchiveConversationSchema.parse({ archived: true });
 * ```
 */
export const ArchiveConversationSchema = z
    .object({
        /** Archive (`true`) or restore (`false`) the conversation. */
        archived: z.boolean()
    })
    .strict();

/** TypeScript type inferred from {@link ArchiveConversationSchema}. */
export type ArchiveConversation = z.infer<typeof ArchiveConversationSchema>;

// ============================================================================
// CreateMessageSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/.../conversations/:id/messages`.
 *
 * Used by both guest (public token-authenticated) and owner (protected/admin)
 * message-send endpoints.  `.strict()` rejects unknown fields.
 *
 * @example
 * ```ts
 * const body = CreateMessageSchema.parse({ body: 'Hello!' });
 * ```
 */
export const CreateMessageSchema = z
    .object({
        /** Message text body (1..5000 characters). */
        body: z.string().min(1).max(5000)
    })
    .strict();

/** TypeScript type inferred from {@link CreateMessageSchema}. */
export type CreateMessage = z.infer<typeof CreateMessageSchema>;
