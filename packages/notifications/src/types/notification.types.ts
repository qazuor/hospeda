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
    ADMIN_SYSTEM_EVENT = 'admin_system_event',
    FEEDBACK_REPORT = 'feedback_report'
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
    /** Amount in centavos. Optional for renewal reminders when plan price cannot be resolved. */
    amount?: number;
    /** Currency code (e.g. 'ARS'). Optional when amount is not available. */
    currency?: string;
    renewalDate?: string;
    /** Days remaining until renewal. Used in email templates for contextual messaging. */
    daysRemaining?: number;
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

/** Feedback report notifications (Linear API fallback) */
export interface FeedbackReportPayload extends BaseNotificationPayload {
    type: NotificationType.FEEDBACK_REPORT;
    /** Report type label (e.g. "Error de JavaScript", "Sugerencia") */
    reportType: string;
    /** Short title describing the feedback */
    reportTitle: string;
    /** Full description of the issue or suggestion */
    reportDescription: string;
    /** Severity level label (e.g. "Alta", "Media", "Baja") */
    severity?: string;
    /** Steps to reproduce the issue */
    stepsToReproduce?: string;
    /** What the reporter expected to happen */
    expectedResult?: string;
    /** What actually happened */
    actualResult?: string;
    /** URLs of attachments uploaded to Linear */
    attachmentUrls?: string[];
    /** Environment context at the time of submission */
    feedbackEnvironment: {
        /** URL where the feedback was submitted from */
        currentUrl?: string;
        /** Browser name and version */
        browser?: string;
        /** Operating system */
        os?: string;
        /** Viewport dimensions (e.g. "1920x1080") */
        viewport?: string;
        /** ISO 8601 timestamp of when the report was created */
        timestamp: string;
        /** Application source identifier (e.g. "web", "admin") */
        appSource: string;
        /** Deployed application version */
        deployVersion?: string;
        /** Authenticated user ID at the time of the report */
        userId?: string;
        /** Browser console errors captured at submission time */
        consoleErrors?: string[];
        /** JavaScript error that triggered the report */
        errorInfo?: {
            /** Error message */
            message: string;
            /** Stack trace */
            stack?: string;
        };
    };
}

/** Admin notifications */
export interface AdminNotificationPayload extends BaseNotificationPayload {
    type: NotificationType.ADMIN_PAYMENT_FAILURE | NotificationType.ADMIN_SYSTEM_EVENT;
    affectedUserEmail?: string;
    affectedUserId?: string;
    eventDetails: Record<string, unknown>;
    severity: 'info' | 'warning' | 'critical';
}

/**
 * Options for controlling notification send behavior.
 *
 * These flags allow callers to bypass specific side-effects of the send
 * flow when needed (e.g., fire-and-forget feedback emails that should not
 * pollute the billing notification log or produce structured log noise).
 *
 * @example
 * ```ts
 * // Send without logging to DB or logger
 * await notificationService.send(payload, { skipDb: true, skipLogging: true });
 * ```
 */
export interface SendNotificationOptions {
    /** Skip writing to the billing_notification_log table */
    skipDb?: boolean;
    /** Skip structured logging via @repo/logger */
    skipLogging?: boolean;
}

/** Union of all notification payloads */
export type NotificationPayload =
    | PurchaseConfirmationPayload
    | PaymentNotificationPayload
    | SubscriptionEventPayload
    | AddonEventPayload
    | TrialEventPayload
    | AdminNotificationPayload
    | FeedbackReportPayload;
