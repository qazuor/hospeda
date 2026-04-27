/**
 * Notification recipient side values for guest-owner messaging.
 *
 * Identifies which party a conversation notification schedule targets,
 * enabling per-side email dispatch logic without exposing raw email addresses
 * across service boundaries.
 *
 * @module notification-recipient-side.enum
 */

/**
 * The side (party) that should receive a conversation notification.
 *
 * @example
 * ```ts
 * import { NotificationRecipientSideEnum } from '@repo/schemas';
 *
 * const side: NotificationRecipientSideEnum = NotificationRecipientSideEnum.OWNER;
 * ```
 */
export enum NotificationRecipientSideEnum {
    /** Notification targets the guest (anonymous or authenticated). */
    GUEST = 'GUEST',

    /** Notification targets the accommodation owner. */
    OWNER = 'OWNER'
}
