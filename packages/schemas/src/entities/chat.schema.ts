import { z } from 'zod';
import { BaseEntitySchema } from '../common.schema';
import { MessageTypeEnumSchema } from '../enums.schema';

/**
 * Schema representing a message thread between a guest and a host.
 */
export const ChatThreadSchema = BaseEntitySchema.extend({
    /**
     * Accommodation ID this thread is related to.
     */
    accommodation: z.string().uuid({
        message: 'error:chat.accommodationIdInvalid'
    }),

    /**
     * Guest (message initiator or recipient).
     */
    guestId: z.string().uuid({
        message: 'error:chat.guestIdInvalid'
    }),

    /**
     * Host (owner of the accommodation).
     */
    hostId: z.string().uuid({
        message: 'error:chat.hostIdInvalid'
    }),

    /**
     * Whether the conversation is archived.
     */
    isArchived: z.boolean().optional(),

    /**
     * Whether the conversation is blocked by admin or user.
     */
    isBlocked: z.boolean().optional()
});

/**
 * Individual message exchanged between users in a thread.
 */
export const ChatMessageSchema = BaseEntitySchema.extend({
    /**
     * Thread this message belongs to.
     */
    threadId: z.string().uuid({
        message: 'error:chat.threadIdInvalid'
    }),

    /**
     * Sender of the message.
     */
    senderId: z.string().uuid({
        message: 'error:chat.senderIdInvalid'
    }),

    /**
     * Receiver of the message.
     */
    receiverId: z.string().uuid({
        message: 'error:chat.receiverIdInvalid'
    }),

    /**
     * Main content of the message.
     */
    content: z.string().min(1, {
        message: 'error:chat.contentRequired'
    }),

    /**
     * Timestamp of when the message was sent.
     */
    sentAt: z.date(),

    /**
     * Timestamp of when the message was read.
     */
    readAt: z.date().optional(),

    /**
     * Type of message (text, system, image, booking_request).
     */
    type: MessageTypeEnumSchema
});
