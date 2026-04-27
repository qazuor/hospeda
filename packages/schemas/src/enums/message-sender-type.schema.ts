import { z } from 'zod';
import { MessageSenderTypeEnum } from './message-sender-type.enum.js';

/**
 * Message sender type enum schema for validation
 */
export const MessageSenderTypeEnumSchema = z.nativeEnum(MessageSenderTypeEnum, {
    message: 'zodError.enums.messageSenderType.invalid'
});
export type MessageSenderTypeSchema = z.infer<typeof MessageSenderTypeEnumSchema>;
