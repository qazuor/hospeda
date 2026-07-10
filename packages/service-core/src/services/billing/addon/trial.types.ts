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
 * The billing interval a customer selected on the pricing toggle when they
 * started a trial (HOS-115 §5). See {@link resolveIntendedInterval}.
 */
export type TrialIntendedInterval = 'monthly' | 'annual';

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
    /**
     * The billing interval the customer selected when they started this
     * trial (HOS-115 §5, nudge delivery path 2 — logged-in lookup for direct
     * navigation to the pricing page, no `?interval=` query param). Read back
     * from the most-recent trial subscription's `metadata.intendedInterval`
     * via {@link resolveIntendedInterval}. `null` when there is no trial, or
     * the trial recorded no interval (e.g. the accommodation-publish
     * auto-start flow, which never records an intent).
     */
    readonly intendedInterval: TrialIntendedInterval | null;
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
    /**
     * The billing interval the customer selected on the pricing toggle when
     * they started this trial (HOS-115 §5). The trial subscription itself is
     * interval-agnostic (no price, no interval) — this value is stamped
     * as-is into the created subscription's `metadata.intendedInterval` so
     * it can survive as the source of truth for the post-trial conversion
     * nudge (pre-selecting the pricing toggle) and as an analytics
     * dimension. Optional because non-checkout trial-start paths (e.g. the
     * accommodation-publish auto-start flow) have no interval choice to
     * record.
     */
    readonly intendedInterval?: 'monthly' | 'annual';
}

/**
 * MercadoPago return/notification URLs required to route a paid
 * reactivation through the real card-collecting checkout (HOS-114). The
 * caller (the reactivate route) resolves these from env + the
 * authenticated user's locale, mirroring exactly how `/start-paid` builds
 * `InitiatePaidMonthlySubscriptionInput.urls` — see
 * `apps/api/src/routes/billing/checkout-return-urls.ts`, the single shared
 * builder both entry points use, so a paid reactivation and a first-time
 * paid checkout can never diverge on where MercadoPago redirects the user
 * or where it posts webhooks.
 */
export interface ReactivationCheckoutUrls {
    /** MercadoPago `back_url` for the preapproval. */
    readonly paymentMethodReturnUrl: string;
    /** Webhook destination for this preapproval. */
    readonly notificationUrl: string;
}

/**
 * Input for reactivating from trial (HOS-114: paid reactivation now routes
 * through a real MercadoPago preapproval, so the caller must supply the
 * checkout return URLs).
 */
export interface ReactivateFromTrialInput {
    /** Billing customer ID */
    readonly customerId: string;
    /** New plan ID to subscribe to (must resolve to a monthly, paid plan) */
    readonly planId: string;
    /** Checkout return/notification URLs for the MP preapproval (HOS-114). */
    readonly urls: ReactivationCheckoutUrls;
}

/**
 * Result of a successful {@link ReactivateFromTrialInput} call (HOS-114).
 *
 * The created subscription is `incomplete` — NOT active — until the
 * `subscription_preapproval.created` webhook confirms the MercadoPago
 * preapproval. The caller (the route) MUST redirect the user to
 * `checkoutUrl` to complete authorization.
 */
export interface ReactivateFromTrialResult {
    /** Always `true` — the method throws on any failure instead of returning a failure shape. */
    readonly success: true;
    /** New (not-yet-confirmed) subscription ID. */
    readonly subscriptionId: string;
    /** MercadoPago checkout URL the caller must redirect the user to. */
    readonly checkoutUrl: string;
    /** The created subscription's qzpay status — always `'incomplete'` at creation time. */
    readonly status: 'incomplete';
    /** Human-readable summary for the response body. */
    readonly message: string;
}

/**
 * Input for reactivating a canceled subscription (BILL-13). HOS-114: paid
 * reactivation now routes through a real MercadoPago preapproval, so the
 * caller must supply the checkout return URLs (see
 * {@link ReactivateFromTrialInput}).
 */
export interface ReactivateSubscriptionInput {
    /** Billing customer ID */
    readonly customerId: string;
    /** New plan ID to subscribe to (must resolve to a monthly, paid plan) */
    readonly planId: string;
    /** Checkout return/notification URLs for the MP preapproval (HOS-114). */
    readonly urls: ReactivationCheckoutUrls;
}

/**
 * Result from reactivating a canceled subscription (HOS-114: the created
 * subscription is `incomplete` until the webhook confirms the MP
 * preapproval; the caller MUST redirect the user to `checkoutUrl`).
 */
export interface ReactivateSubscriptionResult {
    /** Always `true` — the method throws on any failure instead of returning a failure shape. */
    readonly success: true;
    /** New (not-yet-confirmed) subscription ID. */
    readonly subscriptionId: string;
    /** Previous plan ID (from the canceled subscription), or null */
    readonly previousPlanId: string | null;
    /** MercadoPago checkout URL the caller must redirect the user to. */
    readonly checkoutUrl: string;
    /** The created subscription's qzpay status — always `'incomplete'` at creation time. */
    readonly status: 'incomplete';
    /** Human-readable summary for the response body. */
    readonly message: string;
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
    /**
     * The billing interval the customer originally selected when this trial
     * started (HOS-115 §5), read back from `metadata.intendedInterval` on the
     * QZPay subscription. Untyped/raw at the source — the QZPay SDK does not
     * narrow subscription metadata — so this may be `undefined` (trial-start
     * paths that never recorded an interval, e.g. the accommodation-publish
     * auto-start flow) or any string value. Consumers must validate before
     * trusting it (see {@link buildTrialUpgradeUrl} in `trial.service.ts`,
     * which degrades gracefully for anything other than `'monthly'` /
     * `'annual'`).
     */
    readonly intendedInterval?: string;
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
 * Validates a raw `metadata.intendedInterval` value read off a trial
 * subscription (HOS-115 §5). Untyped/raw at the source — the QZPay SDK does
 * not narrow subscription metadata — so this is the single source of truth
 * for turning that raw value into a trusted {@link TrialIntendedInterval},
 * used both by `buildTrialUpgradeUrl` (nudge delivery path 1, the
 * `TRIAL_EXPIRED` notification link) and `TrialService.getTrialStatus`
 * (nudge delivery path 2, the logged-in lookup for direct navigation).
 *
 * @param rawValue - The raw `metadata.intendedInterval` value (or `undefined`
 *   when the trial never recorded one).
 * @returns The validated interval, or `null` for anything other than the two
 *   known values — degrades gracefully instead of throwing on malformed or
 *   missing metadata.
 *
 * @example
 * ```ts
 * const intendedInterval = resolveIntendedInterval(
 *   (subscription.metadata as Record<string, string> | undefined)?.intendedInterval
 * );
 * ```
 */
export function resolveIntendedInterval(rawValue: unknown): TrialIntendedInterval | null {
    return rawValue === 'monthly' || rawValue === 'annual' ? rawValue : null;
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
