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
 * Default plan slug used by {@link StartTrialInput.planSlug} when the caller
 * does not specify one (HOS-110). This is the single source of truth for the
 * "trial defaults to the base owner plan" rule — every caller that logs or
 * reports which plan a no-slug trial ran against should reference this
 * constant instead of re-hardcoding the literal `'owner-basico'`.
 */
export const DEFAULT_TRIAL_PLAN_SLUG = 'owner-basico';

/**
 * Input for starting a trial.
 *
 * Originally every HOST user received the same trial plan and duration
 * (`owner-basico`, 14 days). HOS-110 generalizes this so any plan that
 * declares a trial (`hasTrial: true` in `billing_plans.metadata`) can be
 * started via this same entry point — the accommodation-publish flow keeps
 * relying on the {@link DEFAULT_TRIAL_PLAN_SLUG} default, while the paid
 * checkout flow can pass the plan the user actually selected.
 */
export interface StartTrialInput {
    /** Billing customer ID */
    readonly customerId: string;
    /**
     * Slug of the plan to start the trial on (matched against `QZPayPlan.name`).
     * Defaults to {@link DEFAULT_TRIAL_PLAN_SLUG} (`'owner-basico'`) when
     * omitted — this preserves the original accommodation-publish behavior,
     * where the accommodation type is an attribute of the accommodation
     * entity, not the trial plan.
     */
    readonly planSlug?: string;
    /**
     * Accommodation whose publish triggered this trial (SPEC-222 Part 2).
     *
     * Referential only ("triggered by"): trials are per-owner, so this id does
     * NOT mean the subscription belongs to a single accommodation. Forwarded to
     * the MercadoPago creation `metadata` as a debugging marker. Optional because
     * other trial-start paths (e.g. auto-start on registration) have no
     * triggering accommodation.
     */
    readonly accommodationId?: string;
    /**
     * Extra trial days to add on top of the resolved plan's own trial length
     * (HOS-110 W1). Sourced from a `trial_extension` promo code (SPEC-262)
     * supplied at checkout by a trial-eligible customer: the effective trial
     * length becomes `(HOSPEDA_TRIAL_DAYS_OVERRIDE ?? planTrialDays) +
     * extraTrialDays`. Omitted (or `0`) for every other trial-start path —
     * the base plan length is used unchanged.
     */
    readonly extraTrialDays?: number;
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
 * Trial configuration declared on a plan's `billing_plans.metadata` JSONB
 * (seeded from `PlanDefinition.hasTrial` / `.trialDays`, see
 * `packages/billing/src/config/plans.config.ts`).
 */
export interface PlanTrialConfig {
    /** Whether the plan declares a trial at all. */
    readonly hasTrial: boolean;
    /** Trial length in days (0 when `hasTrial` is `false`). */
    readonly trialDays: number;
}

/**
 * Reads the trial configuration (`hasTrial` / `trialDays`) off a plan's raw
 * `metadata` value (HOS-110). Single source of truth for this read pattern —
 * used by both `TrialService.startTrial` (to size the trial) and the paid
 * checkout's trial-eligibility check, so the two never drift on how they
 * interpret the same metadata shape.
 *
 * Defensive against malformed/missing metadata: any non-boolean `hasTrial`
 * or non-number `trialDays` resolves to the safe "no trial" default rather
 * than throwing, mirroring `mapDbToPlan` in `plan.crud.ts`.
 *
 * @param metadata - The plan's `metadata` value (typed `unknown` because the
 *   qzpay-core SDK plan shape does not narrow it further).
 * @returns The resolved trial configuration.
 *
 * @example
 * ```ts
 * const { hasTrial, trialDays } = resolvePlanTrialConfig(plan.metadata);
 * if (hasTrial && trialDays > 0) {
 *   // eligible for a no-card trial
 * }
 * ```
 */
export function resolvePlanTrialConfig(metadata: unknown): PlanTrialConfig {
    const meta = (metadata ?? {}) as Record<string, unknown>;
    return {
        hasTrial: typeof meta.hasTrial === 'boolean' ? meta.hasTrial : false,
        trialDays: typeof meta.trialDays === 'number' ? meta.trialDays : 0
    };
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
