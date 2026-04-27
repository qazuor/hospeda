/**
 * Message visibility status values for guest-owner messaging.
 *
 * Controls whether a message is displayed normally in the conversation
 * thread or is a platform-generated system notice.
 *
 * @module message-status.enum
 */

/**
 * Visibility state of an individual message.
 *
 * @example
 * ```ts
 * import { MessageStatusEnum } from '@repo/schemas';
 *
 * const status: MessageStatusEnum = MessageStatusEnum.VISIBLE;
 * ```
 */
export enum MessageStatusEnum {
    /** Message is visible to both parties in the conversation thread. */
    VISIBLE = 'VISIBLE',

    /** Platform-generated system message (e.g., "conversation closed", verification notices). */
    SYSTEM = 'SYSTEM'
}
