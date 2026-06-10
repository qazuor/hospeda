/**
 * Billing settings types.
 *
 * These mirror the authoritative API contract served by
 * `GET /api/v1/admin/billing/settings` (see apps/api/src/routes/billing/settings.ts
 * `billingSettingsSchema`). The shape is FLAT — the previous nested
 * trial/payment/webhook/notification model did not match the API and crashed
 * the page (SPEC-143 smoke F-ADMIN-SETTINGS). Webhook config is env-managed
 * (not part of this settings surface), so it is intentionally absent.
 */
export interface BillingSettings {
    /** Trial length (days) for owner plans. */
    ownerTrialDays: number;
    /** Trial length (days) for complex plans. */
    complexTrialDays: number;
    /** Block features automatically when a trial expires. */
    trialAutoBlock: boolean;
    /** Grace period (days) before blocking on payment failure. */
    gracePeriodDays: number;
    /** Default currency ISO code (3 letters). */
    currency: string;
    /** Tax rate percentage (0-100). */
    taxRate: number;
    /** Max automatic payment retries. */
    maxPaymentRetries: number;
    /** Hours between payment retries. */
    retryIntervalHours: number;
    /** Send a reminder before a trial expires. */
    sendTrialExpiryReminder: boolean;
    /** Days before trial expiry to send the reminder. */
    trialExpiryReminderDays: number;
    /** Notify the customer when a payment fails. */
    sendPaymentFailedNotification: boolean;
    /** Notify the customer when a subscription is cancelled. */
    sendSubscriptionCancelledNotification: boolean;
}

/**
 * Update payload — every field is optional (PATCH semantics). Mirrors the API's
 * `updateBillingSettingsSchema = billingSettingsSchema.partial()`.
 */
export type UpdateBillingSettingsPayload = Partial<BillingSettings>;
