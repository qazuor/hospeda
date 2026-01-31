/**
 * All notification types supported by the system
 */
export enum NotificationType {
    SUBSCRIPTION_PURCHASE = 'subscription_purchase',
    ADDON_PURCHASE = 'addon_purchase',
    PAYMENT_SUCCESS = 'payment_success',
    PAYMENT_FAILURE = 'payment_failure',
    RENEWAL_REMINDER = 'renewal_reminder',
    PLAN_CHANGE_CONFIRMATION = 'plan_change_confirmation',
    ADDON_EXPIRATION_WARNING = 'addon_expiration_warning',
    ADDON_EXPIRED = 'addon_expired',
    ADDON_RENEWAL_CONFIRMATION = 'addon_renewal_confirmation',
    TRIAL_ENDING_REMINDER = 'trial_ending_reminder',
    TRIAL_EXPIRED = 'trial_expired',
    ADMIN_PAYMENT_FAILURE = 'admin_payment_failure',
    ADMIN_SYSTEM_EVENT = 'admin_system_event'
}

/**
 * Notification category for preference management
 */
export enum NotificationCategory {
    /** Always sent, cannot be opted out */
    TRANSACTIONAL = 'transactional',
    /** Can be opted out by user */
    REMINDER = 'reminder',
    /** Sent to admin email list only */
    ADMIN = 'admin'
}

/** Base payload all notifications carry */
export interface BaseNotificationPayload {
    type: NotificationType;
    recipientEmail: string;
    recipientName: string;
    userId: string | null;
    customerId?: string;
    idempotencyKey?: string;
}

/** Purchase confirmation (subscription or addon) */
export interface PurchaseConfirmationPayload extends BaseNotificationPayload {
    type: NotificationType.SUBSCRIPTION_PURCHASE | NotificationType.ADDON_PURCHASE;
    planName: string;
    amount: number;
    currency: string;
    billingPeriod?: string;
    nextBillingDate?: string;
}

/** Payment success/failure */
export interface PaymentNotificationPayload extends BaseNotificationPayload {
    type: NotificationType.PAYMENT_SUCCESS | NotificationType.PAYMENT_FAILURE;
    amount: number;
    currency: string;
    planName: string;
    failureReason?: string;
    retryDate?: string;
    paymentMethod?: string;
}

/** Subscription events (renewal, plan change) */
export interface SubscriptionEventPayload extends BaseNotificationPayload {
    type: NotificationType.RENEWAL_REMINDER | NotificationType.PLAN_CHANGE_CONFIRMATION;
    planName: string;
    amount: number;
    currency: string;
    renewalDate?: string;
    oldPlanName?: string;
    newPlanName?: string;
}

/** Add-on lifecycle events */
export interface AddonEventPayload extends BaseNotificationPayload {
    type:
        | NotificationType.ADDON_EXPIRATION_WARNING
        | NotificationType.ADDON_EXPIRED
        | NotificationType.ADDON_RENEWAL_CONFIRMATION;
    addonName: string;
    expirationDate?: string;
    daysRemaining?: number;
    amount?: number;
    currency?: string;
}

/** Trial lifecycle events */
export interface TrialEventPayload extends BaseNotificationPayload {
    type: NotificationType.TRIAL_ENDING_REMINDER | NotificationType.TRIAL_EXPIRED;
    planName: string;
    trialEndDate: string;
    daysRemaining?: number;
    upgradeUrl: string;
}

/** Admin notifications */
export interface AdminNotificationPayload extends BaseNotificationPayload {
    type: NotificationType.ADMIN_PAYMENT_FAILURE | NotificationType.ADMIN_SYSTEM_EVENT;
    affectedUserEmail?: string;
    affectedUserId?: string;
    eventDetails: Record<string, unknown>;
    severity: 'info' | 'warning' | 'critical';
}

/** Union of all notification payloads */
export type NotificationPayload =
    | PurchaseConfirmationPayload
    | PaymentNotificationPayload
    | SubscriptionEventPayload
    | AddonEventPayload
    | TrialEventPayload
    | AdminNotificationPayload;
