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
// Inquiry booking fields (HOS-2534)
// ============================================================================

/** Largest guest count an inquiry may carry. The listing's own capacity is checked client-side. */
export const INQUIRY_MAX_GUESTS = 100;

/**
 * Optional booking context a visitor may attach to an inquiry: check-in date,
 * check-out date and guest count. Every field is independent and optional;
 * dates are plain ISO calendar dates (`YYYY-MM-DD`, no time).
 */
export const InquiryBookingFieldsShape = {
    /** Check-in calendar date (`YYYY-MM-DD`). */
    checkIn: z.string().date({ message: 'zodError.conversation.checkIn.invalid' }).optional(),

    /** Check-out calendar date (`YYYY-MM-DD`). Must be after `checkIn` when both are given. */
    checkOut: z.string().date({ message: 'zodError.conversation.checkOut.invalid' }).optional(),

    /** Number of guests: a positive integer up to {@link INQUIRY_MAX_GUESTS}. */
    guests: z
        .number()
        .int({ message: 'zodError.conversation.guests.invalid' })
        .min(1, { message: 'zodError.conversation.guests.min' })
        .max(INQUIRY_MAX_GUESTS, { message: 'zodError.conversation.guests.max' })
        .optional()
} as const;

/**
 * Refinement shared by the initiate schemas: when both dates are present the
 * check-out must fall strictly after the check-in. ISO dates compare correctly
 * as strings.
 */
export function refineInquiryDates<T extends { checkIn?: string; checkOut?: string }>(
    data: T
): boolean {
    return !data.checkIn || !data.checkOut || data.checkOut > data.checkIn;
}

/** Issue metadata for {@link refineInquiryDates}. */
const inquiryDatesIssue = {
    message: 'zodError.conversation.checkOut.afterCheckIn',
    path: ['checkOut']
};

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
export const CreateConversationAnonObjectSchema = z
    .object({
        /** UUID of the accommodation the guest is enquiring about. */
        accommodationId: z.string().uuid(),

        /** Guest's full display name (1..255 characters). */
        guestName: z
            .string()
            .min(1, { message: 'zodError.conversation.guestName.min' })
            .max(255, { message: 'zodError.conversation.guestName.max' }),

        /** Guest's email address — used for email verification. */
        guestEmail: z.string().email({ message: 'zodError.conversation.guestEmail.invalid' }),

        /** Optional guest phone number. */
        guestPhone: z
            .string()
            .max(50, { message: 'zodError.conversation.guestPhone.max' })
            .optional(),

        /** Opening message from the guest (1..5000 characters). */
        message: z
            .string()
            .min(1, { message: 'zodError.conversation.message.min' })
            .max(5000, { message: 'zodError.conversation.message.max' }),

        /** Preferred locale for system notifications (e.g. "es", "en", "pt"). */
        locale: z.string().max(10).optional(),

        ...InquiryBookingFieldsShape
    })
    .strict();

/**
 * Anonymous initiate body, with the check-out-after-check-in rule applied.
 * Use {@link CreateConversationAnonObjectSchema} when the plain object is needed
 * (e.g. `.omit()`).
 */
export const CreateConversationAnonSchema = CreateConversationAnonObjectSchema.refine(
    refineInquiryDates,
    inquiryDatesIssue
);

/** TypeScript type inferred from {@link CreateConversationAnonSchema}. */
export type CreateConversationAnon = z.infer<typeof CreateConversationAnonSchema>;

// ============================================================================
// CreateConversationAuthSchema
// ============================================================================

/**
 * Request body for `POST /api/v1/protected/conversations/initiate` (authenticated user).
 *
 * The authenticated caller's identity is resolved from the session, so the body
 * only needs the accommodation UUID and the opening message (plus the optional
 * booking fields).  `.strict()` rejects
 * any extra guest-identity fields.
 *
 * @example
 * ```ts
 * const body = CreateConversationAuthSchema.parse(req.json());
 * ```
 */
export const CreateConversationAuthObjectSchema = z
    .object({
        /** UUID of the accommodation the user is enquiring about. */
        accommodationId: z.string().uuid(),

        /** Opening message (1..5000 characters). */
        message: z.string().min(1).max(5000),

        /** Preferred locale for system notifications (e.g. "es", "en", "pt"). */
        locale: z.string().max(10).optional(),

        ...InquiryBookingFieldsShape
    })
    .strict();

/**
 * Authenticated initiate body, with the check-out-after-check-in rule applied.
 * Use {@link CreateConversationAuthObjectSchema} when the plain object is needed.
 */
export const CreateConversationAuthSchema = CreateConversationAuthObjectSchema.refine(
    refineInquiryDates,
    inquiryDatesIssue
);

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
