/**
 * Billing settings types
 */

/**
 * Trial configuration
 */
export interface TrialSettings {
    /** Trial duration in days */
    trialDurationDays: number;
    /** Auto-block on expiry */
    autoBlockOnExpiry: boolean;
}

/**
 * Payment configuration
 */
export interface PaymentSettings {
    /** Grace period duration in days */
    gracePeriodDays: number;
    /** Payment retry attempts */
    paymentRetryAttempts: number;
    /** Retry interval in hours */
    retryIntervalHours: number;
    /** Default currency */
    defaultCurrency: string;
}

/**
 * Webhook configuration
 */
export interface WebhookSettings {
    /** Webhook URL */
    webhookUrl: string;
    /** Webhook secret (masked) */
    webhookSecret: string;
    /** Last webhook received timestamp */
    lastWebhookReceivedAt: string | null;
}

/**
 * Notification configuration
 */
export interface NotificationSettings {
    /** Send payment reminders */
    sendPaymentReminders: boolean;
    /** Reminder days before due */
    reminderDaysBeforeDue: number;
    /** Send receipt on payment */
    sendReceiptOnPayment: boolean;
}

/**
 * Complete billing settings
 */
export interface BillingSettings {
    trial: TrialSettings;
    payment: PaymentSettings;
    webhook: WebhookSettings;
    notification: NotificationSettings;
}

/**
 * Update billing settings payload
 */
export interface UpdateBillingSettingsPayload {
    trial?: Partial<TrialSettings>;
    payment?: Partial<PaymentSettings>;
    notification?: Partial<NotificationSettings>;
}
