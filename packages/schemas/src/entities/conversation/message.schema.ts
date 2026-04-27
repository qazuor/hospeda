/**
 * @module entities/conversation/message.schema
 *
 * Base Zod schema for the `messages` entity (SPEC-085).
 */

import { z } from 'zod';
import { MessageSenderTypeEnum } from '../../enums/message-sender-type.enum.js';
import { MessageStatusEnum } from '../../enums/message-status.enum.js';

/**
 * Core message schema — mirrors the `messages` DB table.
 *
 * @example
 * ```ts
 * const msg = MessageSchema.parse(row);
 * ```
 */
export const MessageSchema = z.object({
    id: z.string().uuid(),
    conversationId: z.string().uuid(),
    senderType: z.nativeEnum(MessageSenderTypeEnum),
    userId: z.string().uuid().nullable(),
    body: z.string().min(1).max(5000),
    status: z.nativeEnum(MessageStatusEnum),
    createdAt: z.union([z.string().datetime(), z.date()]),
    updatedAt: z.union([z.string().datetime(), z.date()]),
    deletedAt: z.union([z.string().datetime(), z.date()]).nullable(),
    createdById: z.string().uuid().nullable(),
    updatedById: z.string().uuid().nullable(),
    deletedById: z.string().uuid().nullable()
});

/** TypeScript type inferred from {@link MessageSchema}. */
export type Message = z.infer<typeof MessageSchema>;

export { MessageSenderTypeEnum, MessageStatusEnum };
