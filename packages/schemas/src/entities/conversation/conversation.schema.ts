/**
 * @module entities/conversation/conversation.schema
 *
 * Base Zod schema for the `conversations` entity (SPEC-085).
 */

import { z } from 'zod';
import { ConversationStatusEnum } from '../../enums/conversation-status.enum.js';

/**
 * Core conversation schema — mirrors the `conversations` DB table.
 *
 * @example
 * ```ts
 * const conv = ConversationSchema.parse(row);
 * ```
 */
export const ConversationSchema = z.object({
    id: z.string().uuid(),
    accommodationId: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    anonymousName: z.string().max(100).nullable(),
    anonymousEmail: z.string().email().max(255).nullable(),
    anonymousEmailVerified: z.boolean(),
    anonymousPhone: z.string().max(50).nullable(),
    status: z.nativeEnum(ConversationStatusEnum),
    blockReason: z.string().max(1000).nullable(),
    locale: z.string().max(10),
    archivedByGuest: z.boolean(),
    archivedByOwner: z.boolean(),
    lastReadAtByGuest: z.union([z.string().datetime(), z.date()]).nullable(),
    lastReadAtByOwner: z.union([z.string().datetime(), z.date()]).nullable(),
    firstGuestMessageAt: z.union([z.string().datetime(), z.date()]).nullable(),
    firstOwnerReplyAt: z.union([z.string().datetime(), z.date()]).nullable(),
    lastActivityAt: z.union([z.string().datetime(), z.date()]).nullable(),
    lastGuestMessageAt: z.union([z.string().datetime(), z.date()]).nullable(),
    lastOwnerMessageAt: z.union([z.string().datetime(), z.date()]).nullable(),
    closedAt: z.union([z.string().datetime(), z.date()]).nullable(),
    blockedAt: z.union([z.string().datetime(), z.date()]).nullable(),
    guestMessageCount: z.number().int().min(0),
    ownerMessageCount: z.number().int().min(0),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()]),
    deletedAt: z.union([z.string().datetime(), z.date()]).nullable(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable(),
    deletedById: z.string().uuid().nullable()
});

/** TypeScript type inferred from {@link ConversationSchema}. */
export type Conversation = z.infer<typeof ConversationSchema>;
