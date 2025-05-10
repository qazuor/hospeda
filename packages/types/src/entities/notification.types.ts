import type {
    NotificationChannelEnum,
    NotificationStateEnum,
    NotificationTypeEnum,
    RoleTypeEnum
} from '../enums.types';

/**
 * Defines the target audience for a notification.
 * It can be a specific user, a list of roles, or everyone.
 */
export interface NotificationTargetType {
    /**
     * Defines the target strategy:
     * - 'all': sent to everyone
     * - 'roles': sent to specific roles
     * - 'user': sent to a specific user
     */
    type: 'all' | 'roles' | 'user';

    /**
     * Roles to which the notification applies (only if type is 'roles').
     */
    roles?: RoleTypeEnum[];

    /**
     * List of user IDs to notify (optional override).
     */
    userIds?: string[];

    /**
     * Single user ID target (only if type is 'user').
     */
    userId?: string;
}

/**
 * Represents a notification to be sent via email, push, etc.
 */
export interface NotificationType {
    /**
     * Classification of the notification for analytics or routing.
     */
    type: NotificationTypeEnum;

    /**
     * Short title of the notification.
     */
    title: string;

    /**
     * Plain text message content.
     */
    message: string;

    /**
     * Optional rich HTML version of the message (used for email).
     */
    htmlMessage?: string;

    /**
     * Channels to deliver the notification (e.g., EMAIL, PUSH).
     */
    channels: NotificationChannelEnum[];

    /**
     * Who the notification is intended for.
     */
    target: NotificationTargetType;

    /**
     * Optional scheduled send time.
     */
    scheduledAt?: Date;

    /**
     * Timestamp when the notification was sent.
     */
    sentAt?: Date;

    /**
     * Delivery status of the notification.
     */
    status: NotificationStateEnum;

    /**
     * Optional additional data, e.g., tracking ID or context info.
     */
    metadata?: Record<string, unknown>;
}
