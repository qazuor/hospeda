import type { BaseEntityType } from '../common.types';
import type { MessageTypeEnum } from '../enums.types';

/**
 * Represents a conversation thread between a guest and a host.
 * Tied to a specific accommodation listing.
 */
export interface ChatThreadType extends BaseEntityType {
    /**
     * ID of the accommodation involved in the conversation.
     */
    accommodation: string; // UUID

    /**
     * ID of the guest user (who initiated or is participating).
     */
    guestId: string; // UUID

    /**
     * ID of the host user (owner of the accommodation).
     */
    hostId: string; // UUID

    /**
     * Whether the thread has been archived by either party.
     */
    isArchived?: boolean;

    /**
     * Whether the conversation has been blocked (e.g., by admin).
     */
    isBlocked?: boolean;
}

/**
 * Represents a single message sent between users within a thread.
 */
export interface ChatMessageType extends BaseEntityType {
    /**
     * ID of the parent conversation thread.
     */
    threadId: string;

    /**
     * ID of the sender user.
     */
    senderId: string;

    /**
     * ID of the receiver user.
     */
    receiverId: string;

    /**
     * Textual content of the message (if type is TEXT or SYSTEM).
     */
    content: string;

    /**
     * Timestamp when the message was sent.
     */
    sentAt: Date;

    /**
     * Timestamp when the message was read (if applicable).
     */
    readAt?: Date;

    /**
     * Type of message (e.g., TEXT, IMAGE, BOOKING_REQUEST).
     */
    type: MessageTypeEnum;
}
