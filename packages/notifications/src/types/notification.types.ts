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
    FEEDBACK_REPORT = 'feedback_report',
    CONTACT_SUBMISSION = 'contact_submission',
    SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
    SUBSCRIPTION_PAUSED = 'subscription_paused',
    SUBSCRIPTION_REACTIVATED = 'subscription_reactivated',
    PLAN_DOWNGRADE_LIMIT_WARNING = 'plan_downgrade_limit_warning',
    PAYMENT_RETRY_WARNING = 'payment_retry_warning',
    ADDON_CANCELLATION = 'addon_cancellation',
    /** SPEC-101 — confirmation email sent after a user clicks Subscribe (double opt-in step 1). */
    NEWSLETTER_VERIFICATION = 'newsletter_verification',
    /** SPEC-101 — welcome email sent after the user clicks the verification link. */
    NEWSLETTER_WELCOME = 'newsletter_welcome',
    /** SPEC-101 — campaign delivery payload routed through the dispatch worker. */
    NEWSLETTER_CAMPAIGN = 'newsletter_campaign',
    /**
     * SPEC-173 T-025 — alert sent to SUPER_ADMIN when AI spend crosses a cost
     * threshold (50 / 80 / 100 %) within the current calendar month.
     *
     * Decision (owner-approved 2026-06-04): dedicated type instead of reusing
     * ADMIN_SYSTEM_EVENT so the alert can be de-duplicated by type in
     * `billing_notification_log` without colliding with other system events.
     */
    AI_COST_THRESHOLD_ALERT = 'ai_cost_threshold_alert',
    /**
     * SPEC-147 — confirmation sent to the user immediately after a soft-cancel
     * is accepted (user-initiated, end-of-period cancellation).
     *
     * Distinct from SUBSCRIPTION_CANCELLED (hard-cancel fired by the
     * MercadoPago webhook on subscription.authorized → cancelled).
     * Key difference: soft-cancel preserves access until `accessUntil`
     * (the current billing period_end), so the email explicitly shows that date.
     */
    SUBSCRIPTION_CANCEL_CONFIRMED = 'subscription_cancel_confirmed',
    /**
     * SPEC-147 T-010 — D3 "access ending soon" reminder sent ~3 days before
     * a soft-cancelled subscription's `current_period_end`.
     *
     * Fired once per subscription by the `finalize-cancelled-subs` cron when
     * the period_end falls inside the [now+2d, now+4d] window. A per-sub
     * `SUBSCRIPTION_ACCESS_ENDING_NOTIF` billing event prevents re-sends.
     */
    SUBSCRIPTION_ACCESS_ENDING_SOON = 'subscription_access_ending_soon',
    /**
     * SPEC-148 — notification sent to each active subscriber when their plan
     * is retired by an admin (PLAN_DISABLED_BY_ADMIN admin action).
     *
     * Unlike SUBSCRIPTION_CANCEL_CONFIRMED (user-initiated soft-cancel), this
     * is admin-triggered. The email informs the user the plan is being retired,
     * confirms they keep access until `accessUntil` (current period_end), and
     * prompts them to resubscribe to another plan.
     */
    PLAN_BEING_RETIRED = 'plan_being_retired',
    /**
     * SPEC-239 T-050 — credentials email sent to a newly provisioned
     * COMMERCE_OWNER after an admin triggers the provision-owner action.
     *
     * Contains the owner's temporary password and a link to the
     * change-password page so the owner can set their own password on
     * first login.
     *
     * This is a TRANSACTIONAL notification: it is always sent, cannot be
     * opted out of, and is required for the owner to access their account.
     */
    COMMERCE_OWNER_CREDENTIALS = 'commerce_owner_credentials'
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
    ADMIN = 'admin',
    /**
     * Marketing newsletter category (SPEC-101). Tied to opt-in / double opt-in
     * verification + the dedicated `newsletter_subscribers` table. Unsubscribe
     * is honoured outside of {@link UserSettings.notifications.allowEmails}.
     */
    NEWSLETTER = 'newsletter'
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

/**
 * Payload for public contact form submissions.
 *
 * Sent to the support inbox when a visitor fills out the website contact form.
 * Recipient is the support team, not the user submitting the form.
 *
 * @example
 * ```ts
 * const payload: ContactSubmissionPayload = {
 *   type: NotificationType.CONTACT_SUBMISSION,
 *   recipientEmail: 'info@hospeda.com',
 *   recipientName: 'Hospeda Support',
 *   userId: null,
 *   contactType: 'general',
 *   senderFirstName: 'Juan',
 *   senderLastName: 'Pérez',
 *   senderEmail: 'juan@example.com',
 *   message: 'Quería consultar por...',
 *   submittedAt: '2026-05-06T10:00:00.000Z',
 * };
 * ```
 */
export interface ContactSubmissionPayload extends BaseNotificationPayload {
    type: NotificationType.CONTACT_SUBMISSION;
    /**
     * Localized human-readable label for the contact type (e.g. "Soporte
     * técnico", "Quiero publicar mi alojamiento"). Used directly in the
     * subject line and email template. Sourced from `CONTACT_TYPE_LABELS`
     * in the API submit route, so the schema enum can grow without this
     * type having to track it.
     *
     * Pre-2026-05 this was the raw enum value (`'general' | 'accommodation'`).
     * After expanding ContactTypeEnumSchema to 9 categories, switching to a
     * label-string keeps the notification payload decoupled from the enum.
     */
    readonly contactType: string;
    /** First name supplied by the form */
    readonly senderFirstName: string;
    /** Last name supplied by the form */
    readonly senderLastName: string;
    /** Reply-to email address for the support team */
    readonly senderEmail: string;
    /** Free-form message body (sanitized plain text, may contain newlines) */
    readonly message: string;
    /** Optional accommodation UUID when contactType is "accommodation" */
    readonly accommodationId?: string;
    /** ISO 8601 timestamp of when the form was submitted */
    readonly submittedAt: string;
}

/** Payload for subscription lifecycle notifications (cancellation, pause, reactivation) */
export interface SubscriptionLifecyclePayload extends BaseNotificationPayload {
    readonly type:
        | NotificationType.SUBSCRIPTION_CANCELLED
        | NotificationType.SUBSCRIPTION_PAUSED
        | NotificationType.SUBSCRIPTION_REACTIVATED;
    readonly planName: string;
    readonly currentPeriodEnd?: string;
    readonly nextBillingDate?: string;
}

/**
 * Payload for soft-cancel confirmation notifications (SPEC-147).
 *
 * Sent immediately when a user initiates a soft-cancel (end-of-period
 * cancellation). Unlike the hard-cancel webhook event, the subscription
 * remains active until `accessUntil` (the current billing period_end).
 *
 * @example
 * ```ts
 * const payload: SubscriptionCancelConfirmedPayload = {
 *   type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   customerId: 'cus-uuid',
 *   planName: 'Plan Standard',
 *   accessUntil: '2026-07-15T23:59:59.000Z',
 * };
 * ```
 */
export interface SubscriptionCancelConfirmedPayload extends BaseNotificationPayload {
    readonly type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED;
    /** Human-readable plan name shown in the email body */
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end — the date until
     * which the user retains full access despite the cancellation.
     */
    readonly accessUntil: string;
}

/**
 * Payload for the D3 "access ending soon" reminder notification (SPEC-147 T-010).
 *
 * Sent ~3 days before a soft-cancelled subscription's `current_period_end` by
 * the `finalize-cancelled-subs` cron. The subscription is still active at this
 * point; the email nudges the user to reactivate before access is lost.
 *
 * @example
 * ```ts
 * const payload: SubscriptionAccessEndingSoonPayload = {
 *   type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   customerId: 'cus-uuid',
 *   planName: 'Plan Standard',
 *   accessUntil: '2026-07-18T23:59:59.000Z',
 *   daysRemaining: 3,
 * };
 * ```
 */
export interface SubscriptionAccessEndingSoonPayload extends BaseNotificationPayload {
    readonly type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON;
    /** Human-readable plan name shown in the email body */
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end — the date on which
     * access will be revoked if the subscription is not reactivated.
     */
    readonly accessUntil: string;
    /**
     * Number of days remaining until access is lost (computed from the cron
     * run time vs `current_period_end`, ceiling-rounded).
     */
    readonly daysRemaining: number;
}

/**
 * Payload for plan downgrade limit warning notifications.
 *
 * Sent when a plan downgrade causes a specific resource limit to decrease
 * while the user's current usage is at or near the new (lower) limit.
 *
 * @example
 * ```ts
 * const payload: PlanDowngradeLimitWarningPayload = {
 *   type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   limitKey: 'accommodations',
 *   oldLimit: 10,
 *   newLimit: 3,
 *   currentUsage: 7,
 *   planName: 'Basic',
 * };
 * ```
 */
export interface PlanDowngradeLimitWarningPayload extends BaseNotificationPayload {
    type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING;
    /** Identifier for the resource limit (e.g. 'accommodations', 'photos') */
    limitKey: string;
    /** The limit value before the downgrade */
    oldLimit: number;
    /** The limit value after the downgrade */
    newLimit: number;
    /** The user's current usage count for this resource */
    currentUsage: number;
    /** The name of the plan the user is downgrading to */
    planName: string;
}

/**
 * Payload for payment retry warning notifications.
 *
 * Sent when a subscription payment fails and the system will automatically retry.
 * Warns the user how many attempts remain before auto-cancellation.
 *
 * @example
 * ```ts
 * const payload: PaymentRetryWarningPayload = {
 *   type: NotificationType.PAYMENT_RETRY_WARNING,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   customerId: 'cus-uuid',
 *   failureCount: 2,
 *   maxRetries: 3,
 *   paymentMethodHint: 'Visa terminada en 4242',
 * };
 * ```
 */
export interface PaymentRetryWarningPayload extends BaseNotificationPayload {
    type: NotificationType.PAYMENT_RETRY_WARNING;
    /** Number of payment failures so far (1-based) */
    readonly failureCount: number;
    /** Maximum number of retries before auto-cancellation */
    readonly maxRetries: number;
    /** Optional masked payment method hint shown to the user */
    readonly paymentMethodHint?: string;
}

/**
 * Payload for addon cancellation notifications.
 *
 * Sent to the user when one of their active add-ons is cancelled, either
 * voluntarily (user-initiated) or administratively.
 *
 * @example
 * ```ts
 * const payload: AddonCancellationPayload = {
 *   type: NotificationType.ADDON_CANCELLATION,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   customerId: 'cus-uuid',
 *   addonName: 'Fotos extra',
 *   canceledAt: '2026-03-17T10:00:00.000Z',
 * };
 * ```
 */
export interface AddonCancellationPayload extends BaseNotificationPayload {
    type: NotificationType.ADDON_CANCELLATION;
    /** Human-readable add-on name shown in the email body */
    readonly addonName: string;
    /** ISO 8601 timestamp of when the add-on was cancelled */
    readonly canceledAt: string;
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
 * Payload for AI cost threshold alert notifications (SPEC-173 T-025).
 *
 * Sent to each SUPER_ADMIN email address when accumulated AI spend for the
 * current calendar month crosses 50 %, 80 %, or 100 % of the configured
 * cost ceiling.  De-duplication (once per threshold × period) is handled by
 * the `apps/api` factory before this payload is constructed.
 *
 * @example
 * ```ts
 * const payload: AiCostThresholdAlertPayload = {
 *   type: NotificationType.AI_COST_THRESHOLD_ALERT,
 *   recipientEmail: 'admin@hospeda.com.ar',
 *   recipientName: 'Admin',
 *   userId: null,
 *   scope: 'global',
 *   thresholdPct: 80,
 *   spentMicroUsd: 160_000_000,
 *   ceilingMicroUsd: 200_000_000,
 *   period: '2026-06',
 * };
 * ```
 */
export interface AiCostThresholdAlertPayload extends BaseNotificationPayload {
    readonly type: NotificationType.AI_COST_THRESHOLD_ALERT;
    /** Whether the threshold was crossed for the global budget or a specific feature. */
    readonly scope: 'global' | 'feature';
    /**
     * The AI feature whose spend crossed the threshold.
     * Only present when `scope === 'feature'`.
     */
    readonly feature?: string;
    /** The cost band that was crossed (50 %, 80 %, or 100 %). */
    readonly thresholdPct: 50 | 80 | 100;
    /** Accumulated spend for the current calendar month in micro-USD (µUSD). */
    readonly spentMicroUsd: number;
    /** Configured ceiling value in micro-USD (µUSD). */
    readonly ceilingMicroUsd: number;
    /**
     * Calendar month in `YYYY-MM` format (UTC).
     *
     * Used as part of the idempotency key to ensure at-most-one alert per
     * threshold per calendar month.
     *
     * @example `'2026-06'`
     */
    readonly period: string;
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
    /** File attachments to include in the email (e.g., feedback screenshots) */
    emailAttachments?: Array<{
        /** Filename shown to the recipient */
        filename: string;
        /** File content as Buffer or base64 string */
        content: Buffer | string;
        /** MIME type (e.g., "image/png") */
        contentType?: string;
    }>;
}

/**
 * Payload for plan-being-retired notifications (SPEC-148).
 *
 * Sent to each active subscriber when an admin retires a billing plan. The
 * subscriber keeps access until `accessUntil` (their current billing period_end)
 * and is prompted to resubscribe to another plan before that date.
 *
 * @example
 * ```ts
 * const payload: PlanBeingRetiredPayload = {
 *   type: NotificationType.PLAN_BEING_RETIRED,
 *   recipientEmail: 'owner@example.com',
 *   recipientName: 'Juan',
 *   userId: 'user-uuid',
 *   customerId: 'cus-uuid',
 *   planName: 'Plan Standard',
 *   accessUntil: '2026-08-15T23:59:59.000Z',
 *   migrationHint: 'Re-subscribe to another plan to keep premium features',
 * };
 * ```
 */
export interface PlanBeingRetiredPayload extends BaseNotificationPayload {
    readonly type: NotificationType.PLAN_BEING_RETIRED;
    /** Human-readable plan name shown in the email body */
    readonly planName: string;
    /**
     * ISO 8601 date-time string for the billing period_end — the date until
     * which the user retains full access despite the plan retirement.
     */
    readonly accessUntil: string;
    /**
     * Short plain-text prompt shown in the email encouraging the user to
     * resubscribe (e.g. "Re-subscribe to another plan to keep premium features").
     */
    readonly migrationHint: string;
}

/**
 * Payload for the COMMERCE_OWNER_CREDENTIALS notification (SPEC-239 T-050).
 *
 * Sent to a newly provisioned commerce owner immediately after an admin
 * triggers the provision-owner action.  Contains the temporary password
 * and a link to the change-password page.
 *
 * **Security note**: `temporaryPassword` is included so the email body can
 * display it to the recipient.  It MUST NOT be stored in the
 * `billing_notification_log` metadata beyond what the transport already logs,
 * and it MUST NOT appear in API responses.
 *
 * @example
 * ```ts
 * const payload: CommerceOwnerCredentialsPayload = {
 *   type: NotificationType.COMMERCE_OWNER_CREDENTIALS,
 *   recipientEmail: 'owner@mirestaurante.com',
 *   recipientName: 'Juan Pérez',
 *   userId: 'user-uuid',
 *   leadId: 'lead-uuid',
 *   temporaryPassword: 'abc123xyz456',
 *   changePasswordUrl: 'https://hospeda.com.ar/mi-cuenta/cambiar-contrasena',
 * };
 * ```
 */
export interface CommerceOwnerCredentialsPayload extends BaseNotificationPayload {
    readonly type: NotificationType.COMMERCE_OWNER_CREDENTIALS;
    /**
     * The server-generated temporary password to display in the email.
     * NEVER store this in plain text beyond the email send.
     */
    readonly temporaryPassword: string;
    /**
     * UUID of the commerce lead that triggered this provisioning.
     * Used for traceability in logs.
     */
    readonly leadId: string;
    /**
     * Full URL to the change-password page.
     * Constructed from siteUrl + '/mi-cuenta/cambiar-contrasena'.
     */
    readonly changePasswordUrl: string;
}

/** Union of all notification payloads */
export type NotificationPayload =
    | PurchaseConfirmationPayload
    | PaymentNotificationPayload
    | SubscriptionEventPayload
    | SubscriptionLifecyclePayload
    | AddonEventPayload
    | TrialEventPayload
    | AdminNotificationPayload
    | FeedbackReportPayload
    | ContactSubmissionPayload
    | PlanDowngradeLimitWarningPayload
    | PaymentRetryWarningPayload
    | AddonCancellationPayload
    | AiCostThresholdAlertPayload
    | SubscriptionCancelConfirmedPayload
    | SubscriptionAccessEndingSoonPayload
    | PlanBeingRetiredPayload
    | CommerceOwnerCredentialsPayload;
