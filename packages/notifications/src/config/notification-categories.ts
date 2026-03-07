import { NotificationCategory, NotificationType } from '../types/notification.types.js';

/**
 * Maps each notification type to its category for preference handling
 */
export const NOTIFICATION_CATEGORY_MAP: Record<NotificationType, NotificationCategory> = {
    // Transactional - Always sent, cannot be opted out
    [NotificationType.SUBSCRIPTION_PURCHASE]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.ADDON_PURCHASE]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.PAYMENT_SUCCESS]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.PAYMENT_FAILURE]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.PLAN_CHANGE_CONFIRMATION]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.ADDON_RENEWAL_CONFIRMATION]: NotificationCategory.TRANSACTIONAL,

    // Reminders - Can be opted out
    [NotificationType.RENEWAL_REMINDER]: NotificationCategory.REMINDER,
    [NotificationType.ADDON_EXPIRATION_WARNING]: NotificationCategory.REMINDER,
    [NotificationType.ADDON_EXPIRED]: NotificationCategory.REMINDER,
    [NotificationType.TRIAL_ENDING_REMINDER]: NotificationCategory.REMINDER,
    [NotificationType.TRIAL_EXPIRED]: NotificationCategory.REMINDER,

    // Admin - Sent to admin email list only
    [NotificationType.ADMIN_PAYMENT_FAILURE]: NotificationCategory.ADMIN,
    [NotificationType.ADMIN_SYSTEM_EVENT]: NotificationCategory.ADMIN,

    // Feedback - Always sent, cannot be opted out
    [NotificationType.FEEDBACK_REPORT]: NotificationCategory.TRANSACTIONAL,

    // Subscription lifecycle - Transactional, always sent
    [NotificationType.SUBSCRIPTION_CANCELLED]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.SUBSCRIPTION_PAUSED]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.SUBSCRIPTION_REACTIVATED]: NotificationCategory.TRANSACTIONAL
};
