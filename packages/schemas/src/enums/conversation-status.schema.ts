import { z } from 'zod';
import { ConversationStatusEnum } from './conversation-status.enum.js';

/**
 * Conversation status enum schema for validation
 */
export const ConversationStatusEnumSchema = z.nativeEnum(ConversationStatusEnum, {
    message: 'zodError.enums.conversationStatus.invalid'
});
export type ConversationStatusSchema = z.infer<typeof ConversationStatusEnumSchema>;
