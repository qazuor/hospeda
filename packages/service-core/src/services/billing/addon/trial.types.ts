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
export interface MonthlyReactivationCheckoutUrls {
    /** MercadoPago `back_url` for the preapproval. */
    readonly paymentMethodReturnUrl: string;
    /** Webhook destination for this preapproval. */
    readonly notificationUrl: string;
}

/**
 * MercadoPago hosted-checkout return URLs for an ANNUAL (one-time charge)
 * reactivation (HOS-123). Annual reactivation goes through
 * `billing.checkout.create({ mode: 'payment' })`, whose hosted checkout has
 * two distinct return paths (`successUrl` / `cancelUrl`) instead of the
 * monthly preapproval's single `back_url` — mirroring the shape
 * `initiatePaidAnnualSubscription` already uses for a first-time annual
 * checkout.
 */
export interface AnnualReactivationCheckoutUrls {
    /** Hosted-checkout redirect after a successful annual payment. */
    readonly successUrl: string;
    /** Hosted-checkout redirect after the user cancels the annual payment. */
    readonly cancelUrl: string;
    /** Webhook destination for this checkout's `payment.updated` events. */
    readonly notificationUrl: string;
}

/**
 * Discriminated union of the checkout return URLs a paid reactivation needs,
 * keyed on the billing interval (OQ-3): the monthly preapproval shape vs the
 * annual hosted-checkout shape. The caller (the reactivate route) picks the
 * correct member based on the request's `billingInterval` before invoking the
 * service.
 */
export type ReactivationCheckoutUrls =
    | MonthlyReactivationCheckoutUrls
    | AnnualReactivationCheckoutUrls;

/**
 * Input for reactivating from trial (HOS-114: paid reactivation now routes
 * through a real MercadoPago preapproval, so the caller must supply the
 * checkout return URLs).
 */
export interface ReactivateFromTrialInput {
    /** Billing customer ID */
    readonly customerId: string;
    /** New plan ID to subscribe to (must resolve to a paid plan) */
    readonly planId: string;
    /**
     * Which recurring price of the target plan to reactivate onto (HOS-123).
     * `'monthly'` (default at the call site) routes through the MercadoPago
     * preapproval; `'annual'` routes through the one-time hosted-checkout
     * charge. A plan can carry both prices, so the interval is explicit
     * rather than inferred (OQ-1).
     */
    readonly billingInterval?: 'monthly' | 'annual';
    /**
     * Checkout return/notification URLs. The `paymentMethodReturnUrl` shape
     * is used for `'monthly'`, the `successUrl`/`cancelUrl` shape for
     * `'annual'` (HOS-114 / HOS-123) — the route resolves the correct member.
     */
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
    /**
     * The created subscription's status at creation time (HOS-123). The two
     * values come from different spaces: `'incomplete'` is qzpay's raw
     * preapproval status for the MONTHLY path; `'pending_provider'` is
     * Hospeda's own {@link SubscriptionStatusEnum.PENDING_PROVIDER} for the
     * ANNUAL path (which bypasses qzpay's `subscriptions.create()` entirely —
     * it's a direct Drizzle insert). Neither means active until the
     * confirming webhook fires.
     */
    readonly status: 'incomplete' | 'pending_provider';
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
    /** New plan ID to subscribe to (must resolve to a paid plan) */
    readonly planId: string;
    /**
     * Which recurring price of the target plan to reactivate onto (HOS-123).
     * `'monthly'` (default at the call site) routes through the MercadoPago
     * preapproval; `'annual'` routes through the one-time hosted-checkout
     * charge (OQ-1). See {@link ReactivateFromTrialInput.billingInterval}.
     */
    readonly billingInterval?: 'monthly' | 'annual';
    /**
     * Checkout return/notification URLs — monthly `paymentMethodReturnUrl`
     * shape or annual `successUrl`/`cancelUrl` shape; the route resolves the
     * correct member (HOS-114 / HOS-123).
     */
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
    /**
     * The created subscription's status at creation time (HOS-123).
     * `'incomplete'` (qzpay preapproval status) for the MONTHLY path;
     * `'pending_provider'` ({@link SubscriptionStatusEnum.PENDING_PROVIDER})
     * for the ANNUAL one-time-charge path. See
     * {@link ReactivateFromTrialResult.status}.
     */
    readonly status: 'incomplete' | 'pending_provider';
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
 * Input for {@link resolveCheckoutFreeTrialDays}.
 */
export interface ResolveCheckoutFreeTrialDaysInput {
    /** Whether the resolved plan declares a trial at all. */
    readonly planHasTrial: boolean;
    /** The plan's declared trial length in days. */
    readonly planTrialDays: number;
    /**
     * `HOSPEDA_TRIAL_DAYS_OVERRIDE` — the ops kill-switch / QA knob. When set it
     * REPLACES the plan's base length (including `0`, which disables trials
     * outright). `undefined` when unset.
     */
    readonly trialDaysOverride: number | undefined;
    /** Extra days from a `trial_extension` promo code, when one was supplied. */
    readonly extraTrialDays: number | undefined;
    /**
     * Whether the customer has ANY prior subscription — any status, any product
     * domain, including cancelled. One trial per customer, for life.
     */
    readonly hasPriorSubscription: boolean;
}

/**
 * The trial decision for a single checkout.
 */
export interface CheckoutFreeTrialDays {
    /**
     * Days to send to MercadoPago as `auto_recurring.free_trial`, or `undefined`
     * when no trial is granted and the customer is charged immediately.
     */
    readonly freeTrialDays: number | undefined;
    /**
     * `true` when a `trial_extension` promo was supplied but no trial was
     * granted, so its days went nowhere. Surface this to the customer rather
     * than silently pocketing their code.
     */
    readonly promoExtensionIgnored: boolean;
}

/**
 * Decides, in ONE place, how many free days a checkout grants (HOS-171 §7.4).
 *
 * ## Why this exists
 *
 * The free trial used to be granted at two different moments: a no-card trial
 * when the plan declared one, and then — separately, later, at checkout — a
 * `trial_extension` promo's days. Nothing summed the two, so a customer could
 * collect both. Card-first collapses them into a single decision made once, at
 * checkout, whose result is a single `free_trial` on a single preapproval.
 *
 * ## The rules, in precedence order
 *
 * 1. **The kill-switch wins first.** `HOSPEDA_TRIAL_DAYS_OVERRIDE=0` disables
 *    every trial. It is evaluated against the BASE length, before any extension
 *    is added, so an extension promo can never resurrect a disabled trial.
 * 2. **A plan that declares no trial gets none**, regardless of any promo. An
 *    override never forces a trial onto such a plan.
 * 3. **One trial per customer, for life.** ANY prior subscription — any status,
 *    any product domain, including cancelled — disqualifies. This guard used to
 *    live inside `TrialService.startTrial`; with that gone, the checkout call
 *    site is the single authoritative gate, so it must be right here.
 * 4. Otherwise the customer gets `base + extension`, as one number.
 *
 * A `trial_extension` promo LENGTHENS a trial. When rules 1-3 grant no trial
 * there is nothing to lengthen, so the promo yields nothing and
 * `promoExtensionIgnored` is set — mirroring how a `discount` code is discarded
 * when the trial wins.
 *
 * Pure and I/O-free: the caller resolves the plan config, the override and the
 * prior-subscription check, so this stays trivially testable.
 *
 * @param input - Plan trial config, ops override, promo extension, and eligibility.
 * @returns The single free-trial length for this checkout, plus whether a supplied
 *   extension promo was ignored.
 *
 * @example
 * ```ts
 * // Trial-eligible, 14-day plan, 60-day extension promo → ONE 74-day free_trial
 * resolveCheckoutFreeTrialDays({
 *   planHasTrial: true, planTrialDays: 14, trialDaysOverride: undefined,
 *   extraTrialDays: 60, hasPriorSubscription: false,
 * }); // => { freeTrialDays: 74, promoExtensionIgnored: false }
 *
 * // The ops kill-switch beats the extension promo
 * resolveCheckoutFreeTrialDays({
 *   planHasTrial: true, planTrialDays: 14, trialDaysOverride: 0,
 *   extraTrialDays: 60, hasPriorSubscription: false,
 * }); // => { freeTrialDays: undefined, promoExtensionIgnored: true }
 * ```
 */
export function resolveCheckoutFreeTrialDays(
    input: ResolveCheckoutFreeTrialDaysInput
): CheckoutFreeTrialDays {
    const { planHasTrial, planTrialDays, trialDaysOverride, extraTrialDays, hasPriorSubscription } =
        input;

    const hasExtension = extraTrialDays !== undefined && extraTrialDays > 0;
    const baseTrialDays = trialDaysOverride ?? planTrialDays;

    // Evaluated against the BASE length, before the extension is added — this
    // ordering is what keeps the kill-switch absolute.
    const grantsTrial = planHasTrial && baseTrialDays > 0 && !hasPriorSubscription;

    if (!grantsTrial) {
        return { freeTrialDays: undefined, promoExtensionIgnored: hasExtension };
    }

    return {
        freeTrialDays: baseTrialDays + (extraTrialDays ?? 0),
        promoExtensionIgnored: false
    };
}

/**
 * Validates a raw `metadata.intendedInterval` value read off a trial
 * subscription (HOS-115 §5). Untyped/raw at the source — the QZPay SDK does
 * not narrow subscription metadata — so this is the single source of truth
 * for turning that raw value into a trusted {@link TrialIntendedInterval},
 * used both by `buildTrialUpgradeUrl` (nudge delivery path 1, the
 * `TRIAL_ENDING_REMINDER` notification link) and `TrialService.getTrialStatus`
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
