/**
 * Trial Service Types
 *
 * Pure type definitions for the trial lifecycle system.
 * These types are used by the TrialService in the API layer
 * and can be shared across packages.
 *
 * @module services/billing/addon/trial.types
 */

/**
 * Trial status information
 */
export interface TrialStatus {
    /** Whether user is currently on trial */
    readonly isOnTrial: boolean;
    /** Whether trial has expired */
    readonly isExpired: boolean;
    /** Trial start date (ISO string) */
    readonly startedAt: string | null;
    /** Trial expiry date (ISO string) */
    readonly expiresAt: string | null;
    /** Days remaining in trial (0 if expired) */
    readonly daysRemaining: number;
    /** Current plan slug */
    readonly planSlug: string | null;
}

/**
 * Input for starting a trial.
 *
 * All HOST users receive the same trial plan and duration.
 * The accommodation type (simple vs complex/hotel) is determined later
 * when the user creates their first accommodation, not at trial start.
 */
export interface StartTrialInput {
    /** Billing customer ID */
    readonly customerId: string;
}

/**
 * Input for reactivating from trial
 */
export interface ReactivateFromTrialInput {
    /** Billing customer ID */
    readonly customerId: string;
    /** New plan ID to subscribe to */
    readonly planId: string;
}

/**
 * Input for reactivating a canceled subscription (BILL-13)
 */
export interface ReactivateSubscriptionInput {
    /** Billing customer ID */
    readonly customerId: string;
    /** New plan ID to subscribe to */
    readonly planId: string;
}

/**
 * Result from reactivating a canceled subscription
 */
export interface ReactivateSubscriptionResult {
    /** New subscription ID */
    readonly subscriptionId: string;
    /** Previous plan ID (from the canceled subscription), or null */
    readonly previousPlanId: string | null;
}

/**
 * Trial ending subscription (for notifications)
 */
export interface TrialEndingSubscription {
    /** Subscription ID */
    readonly id: string;
    /** Customer ID */
    readonly customerId: string;
    /** User email */
    readonly userEmail: string;
    /** User name */
    readonly userName: string;
    /** User ID */
    readonly userId: string;
    /** Plan slug */
    readonly planSlug: string;
    /** Trial end date */
    readonly trialEnd: Date;
    /** Days remaining */
    readonly daysRemaining: number;
}

/**
 * Calculate the number of days remaining from a trial end date.
 *
 * @param trialEnd - The trial expiration date
 * @param now - Current date (defaults to new Date())
 * @returns Number of days remaining (0 if expired)
 */
export function calculateTrialDaysRemaining({
    trialEnd,
    now = new Date()
}: {
    readonly trialEnd: Date;
    readonly now?: Date;
}): number {
    const msRemaining = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
}
