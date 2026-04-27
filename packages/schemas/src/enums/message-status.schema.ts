import { z } from 'zod';
import { MessageStatusEnum } from './message-status.enum.js';

/**
 * Message status enum schema for validation
 */
export const MessageStatusEnumSchema = z.nativeEnum(MessageStatusEnum, {
    message: 'zodError.enums.messageStatus.invalid'
});
export type MessageStatusSchema = z.infer<typeof MessageStatusEnumSchema>;
