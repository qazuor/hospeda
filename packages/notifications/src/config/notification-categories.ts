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

    // Feedback - Sent to admin notification list, not end-user
    [NotificationType.FEEDBACK_REPORT]: NotificationCategory.ADMIN,

    // Contact form submission - Sent to support inbox, not end-user
    [NotificationType.CONTACT_SUBMISSION]: NotificationCategory.ADMIN,

    // Subscription lifecycle - Transactional, always sent
    [NotificationType.SUBSCRIPTION_CANCELLED]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.SUBSCRIPTION_PAUSED]: NotificationCategory.TRANSACTIONAL,
    [NotificationType.SUBSCRIPTION_REACTIVATED]: NotificationCategory.TRANSACTIONAL,

    // Plan management - Transactional
    [NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING]: NotificationCategory.TRANSACTIONAL,

    // Payment retry warning - Transactional (billing-critical)
    [NotificationType.PAYMENT_RETRY_WARNING]: NotificationCategory.TRANSACTIONAL,

    // Addon cancellation - Transactional
    [NotificationType.ADDON_CANCELLATION]: NotificationCategory.TRANSACTIONAL,

    // Newsletter (SPEC-101)
    // Verification is transactional: required by Ley 25.326 AR / GDPR — must
    // be delivered regardless of preferences (the user just asked for it).
    [NotificationType.NEWSLETTER_VERIFICATION]: NotificationCategory.TRANSACTIONAL,
    // Welcome and campaign deliveries respect the opt-out and live in the
    // dedicated NEWSLETTER category so the preference service can route them.
    [NotificationType.NEWSLETTER_WELCOME]: NotificationCategory.NEWSLETTER,
    [NotificationType.NEWSLETTER_CAMPAIGN]: NotificationCategory.NEWSLETTER,

    // AI cost threshold alert (SPEC-173 T-025) — sent to SUPER_ADMIN only
    [NotificationType.AI_COST_THRESHOLD_ALERT]: NotificationCategory.ADMIN,

    // Soft-cancel confirmation (SPEC-147) — always sent, user-initiated
    [NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED]: NotificationCategory.TRANSACTIONAL,

    // D3 access-ending reminder (SPEC-147 T-010) — REMINDER: user can opt out
    [NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON]: NotificationCategory.REMINDER,

    // Plan retirement notification (SPEC-148) — TRANSACTIONAL: admin-triggered, always sent
    [NotificationType.PLAN_BEING_RETIRED]: NotificationCategory.TRANSACTIONAL
};
