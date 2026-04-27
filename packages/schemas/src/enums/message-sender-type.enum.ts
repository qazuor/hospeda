/**
 * Message sender type values for guest-owner messaging.
 *
 * Identifies which party authored a message so the UI can apply
 * correct alignment and labeling without exposing raw user IDs.
 *
 * @module message-sender-type.enum
 */

/**
 * The type of actor that sent a message.
 *
 * @example
 * ```ts
 * import { MessageSenderTypeEnum } from '@repo/schemas';
 *
 * const senderType: MessageSenderTypeEnum = MessageSenderTypeEnum.GUEST;
 * ```
 */
export enum MessageSenderTypeEnum {
    /** Message authored by the guest (anonymous or authenticated). */
    GUEST = 'GUEST',

    /** Message authored by the accommodation owner. */
    OWNER = 'OWNER',

    /** Automated platform message (status changes, reminders, verification notices). */
    SYSTEM = 'SYSTEM'
}
