/**
 * Subscription Checkout Service (SPEC-126 D8)
 *
 * Encapsulates the business logic that initiates a paid subscription:
 *   - plan slug -> qzpay plan lookup,
 *   - active monthly price resolution,
 *   - `billing.subscriptions.create({ mode: 'paid' })` call,
 *   - `providerInitPoint` extraction with sandbox fallback,
 *   - response shape (`checkoutUrl`, `localSubscriptionId`, `expiresAt`).
 *
 * The function is intentionally framework-agnostic: it takes the resolved
 * `billing` instance, the validated input, and the env-resolved URL
 * builders, and returns either a success response or throws a
 * {@link SubscriptionCheckoutError} with a discriminated `code` that the
 * caller maps to its own protocol (HTTP, gRPC, CLI exit code, etc.).
 *
 * The annual branch is intentionally NOT implemented here — it remains
 * deferred per the SPEC-126 D1 annual follow-up note in `spec.md`.
 *
 * @module services/subscription-checkout.service
 */

import type {
    QZPayBilling,
    QZPayPollingResourceType,
    QZPaySubscriptionWithHelpers
} from '@qazuor/qzpay-core';
import { TEST_DAILY_PLAN } from '@repo/billing';
import {
    billingSubscriptions,
    commerceListingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    partnerSubscriptions,
    sql,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import {
    calculatePromoCodeEffect,
    resolveFullPlanPriceCentavos,
    resolvePlanTrialConfig
} from '@repo/service-core';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import { resolveCheckoutPromoPlan } from './subscription-checkout-promo.service.js';
import { createCompSubscription } from './subscription-comp-create.service.js';
import { applySignupDiscountToMonthly } from './subscription-discount-signup.service.js';
import { TrialService } from './trial.service.js';

/**
 * Time-to-live applied to a `pending_provider` subscription before the
 * `abandoned-pending-subs` cron (SPEC-126 D6) flips it to `abandoned`.
 * Exported so callers can reference the same constant when building
 * messages or schedules that should agree with the reaper.
 */
export const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/**
 * Inputs for {@link schedulePollingForSubscription}.
 *
 * Aggregates everything the polling-job storage needs plus a `sourceLabel`
 * for log diagnostics (so an operator can tell which checkout flow
 * enqueued the job from log lines alone). Kept internal because it
 * only makes sense inside this module.
 */
interface SchedulePollingInput {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly providerResourceId: string;
    readonly resourceType: QZPayPollingResourceType;
    readonly planSlug: string;
    readonly sourceLabel: string;
}

/**
 * Shared helper to enqueue a subscription-polling job after a paid
 * subscription is initiated. Both monthly (`subscription`) and annual
 * (`one_time_payment`) flows call this so the env-flag check, error
 * handling, and log shapes stay in one place.
 *
 * Skipped silently when:
 *   - The {@link env.HOSPEDA_BILLING_POLLING_ENABLED} flag is off (test/legacy environments).
 *   - The configured storage adapter does not expose `subscriptionPollingJobs`.
 *   - The provider returned no resource id to poll (defensive guard for
 *     callers that pass an empty string).
 *
 * Non-fatal: a polling-enqueue failure is logged but does not throw —
 * the underlying subscription was created successfully and the webhook
 * remains the primary activation path. This mirrors how the prior
 * inline implementation behaved on the monthly flow.
 */
async function schedulePollingForSubscription(input: SchedulePollingInput): Promise<void> {
    const { billing, subscriptionId, providerResourceId, resourceType, planSlug, sourceLabel } =
        input;

    if (!env.HOSPEDA_BILLING_POLLING_ENABLED) {
        return;
    }

    if (!providerResourceId) {
        apiLogger.warn(
            { subscriptionId, resourceType, sourceLabel },
            'Skipping polling enqueue — provider returned no resource id (cannot poll)'
        );
        return;
    }

    const pollingStorage = billing.getStorage().subscriptionPollingJobs;
    if (!pollingStorage) {
        return;
    }

    try {
        const job = await pollingStorage.create({
            subscriptionId,
            providerResourceId,
            resourceType,
            provider: 'mercadopago',
            metadata: {
                source: sourceLabel,
                planSlug
            }
        });
        if (job) {
            apiLogger.debug(
                {
                    jobId: job.id,
                    subscriptionId,
                    providerResourceId,
                    resourceType,
                    nextPollAt: job.nextPollAt.toISOString()
                },
                'Scheduled subscription polling fallback'
            );
        } else {
            apiLogger.warn(
                { subscriptionId, providerResourceId, resourceType },
                'Active polling job already exists for subscription — skipping enqueue'
            );
        }
    } catch (error) {
        // Non-fatal: subscription was created successfully; failing to
        // schedule polling means we rely entirely on the webhook for
        // activation. Log so an operator can investigate.
        apiLogger.error(
            {
                subscriptionId,
                providerResourceId,
                resourceType,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to enqueue subscription polling job — webhook is the only path now'
        );
    }
}

/**
 * Error codes surfaced by {@link initiatePaidMonthlySubscription}. Each
 * value maps to a distinct user-facing condition; route handlers
 * translate them to HTTP status codes.
 */
export type SubscriptionCheckoutErrorCode =
    | 'PLAN_NOT_FOUND'
    | 'NO_MONTHLY_PRICE'
    | 'NO_ANNUAL_PRICE'
    | 'NO_MATCHING_PRICE'
    | 'CUSTOMER_NOT_FOUND'
    | 'MISSING_INIT_POINT'
    | 'INVALID_PROMO_CODE'
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'SAME_PLAN'
    | 'NOT_AN_UPGRADE'
    // SPEC-262 T-012 P2: the FAIL-CLOSED discount mutation was rejected by MP and
    // the just-created subscription was cancelled. Maps to HTTP 502 (provider
    // rejected our amount change) — distinct from INVALID_PROMO_CODE (422) which
    // is a bad/inactive code, not a provider failure.
    | 'DISCOUNT_APPLY_FAILED';

/**
 * Domain-level error thrown by {@link initiatePaidMonthlySubscription}.
 * Carries a discriminated `code` so callers can branch on the failure
 * mode without parsing `message`.
 */
export class SubscriptionCheckoutError extends Error {
    constructor(
        public readonly code: SubscriptionCheckoutErrorCode,
        message: string
    ) {
        super(message);
        this.name = 'SubscriptionCheckoutError';
    }
}

/**
 * Resolve a plan by its slug. Hospeda treats `QZPayPlan.name` as the
 * slug (mirrors `trial.service.ts:124`). Returns `null` when no plan
 * matches; callers decide whether to throw or fall back.
 *
 * Testing-only gate: the hidden daily test plan ({@link TEST_DAILY_PLAN},
 * slug `owner-test-daily`) always exists as a row in `billing_plans` /
 * `billing_prices` (seeded unconditionally by `seedTestDailyPlan`), but is
 * treated as NOT FOUND here — same as any other unresolvable slug — unless
 * `HOSPEDA_SHOW_TEST_BILLING_PLAN` is `true`. This is the SOLE gate on
 * whether the plan is subscribable: the plan is intentionally excluded from
 * `ALL_PLANS` and every listing (public + protected), so this slug check is
 * the actual safety net, not a defense-in-depth extra. Every caller of
 * `resolvePlanBySlug` (monthly, commerce, annual) inherits the gate for
 * free from this single choke point.
 */
async function resolvePlanBySlug(billing: QZPayBilling, planSlug: string) {
    if (planSlug === TEST_DAILY_PLAN.slug && !env.HOSPEDA_SHOW_TEST_BILLING_PLAN) {
        return null;
    }
    const plansResult = await billing.plans.list();
    return plansResult.data.find((p) => p.name === planSlug) ?? null;
}

/**
 * Get the human-facing display name for a plan, falling back to the slug
 * when no display name is configured.
 *
 * Hospeda stores the slug as `billing_plans.name` (the QZPay-facing lookup
 * key) and the human label in `billing_plans.metadata.displayName` (set by
 * the seed from `PlanDefinition.name`). MercadoPago shows whatever string we
 * pass as the line-item title to the buyer, so this helper centralises the
 * "prefer display name, fall back to slug" rule used by every checkout
 * builder in this file. Slugs like `owner-basico` look bad in the MP
 * checkout screen — display names like `Basic` are what we want.
 */
function getPlanDisplayName(plan: { readonly name: string; readonly metadata?: unknown }): string {
    if (
        typeof plan.metadata === 'object' &&
        plan.metadata !== null &&
        'displayName' in plan.metadata
    ) {
        const displayName = (plan.metadata as Record<string, unknown>).displayName;
        if (typeof displayName === 'string' && displayName.length > 0) {
            return displayName;
        }
    }
    return plan.name;
}

interface PriceShape {
    id: string;
    billingInterval: string;
    intervalCount: number;
    active: boolean;
}

/**
 * Resolve the monthly price within a plan. qzpay-core uses `'month'` with
 * `intervalCount: 1` for monthly; the multi-month variants (quarterly,
 * semi_annual) have the same `'month'` interval but different counts and
 * must be excluded — they belong to plan-change flows, not the initial
 * paid-sub entry point.
 */
function findMonthlyPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'month' && p.intervalCount === 1) ??
        null
    );
}

/**
 * Resolve the daily price within a plan (`billingInterval: 'day'`,
 * `intervalCount: 1`). ONLY used for the hidden test-daily plan
 * ({@link TEST_DAILY_PLAN}) — see the special-case in
 * {@link initiatePaidMonthlySubscription}. No real (non-test) plan is ever
 * expected to carry a `'day'` price row.
 */
function findDailyPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'day' && p.intervalCount === 1) ?? null
    );
}

/**
 * Resolve the annual price within a plan. Matches qzpay-core's `'year'`
 * with `intervalCount: 1`. Hospeda's annual variant is a one-time
 * upfront charge with the discounted full-year price (no recurring
 * preapproval), so a single matching row is sufficient.
 */
function findAnnualPrice<T extends PriceShape>(prices: ReadonlyArray<T>): T | null {
    return (
        prices.find((p) => p.active && p.billingInterval === 'year' && p.intervalCount === 1) ??
        null
    );
}

/**
 * Inputs for {@link computePlanChangeDelta}. All monetary fields are
 * integers in CENTAVOS (matches `billing_prices.unit_amount` storage).
 */
export interface ComputePlanChangeDeltaInput {
    /** Current plan's recurring price for the active interval. */
    readonly currentPriceCentavos: number;
    /** Target plan's recurring price for the same interval. */
    readonly targetPriceCentavos: number;
    /** Start of the active billing period (from `billing_subscriptions`). */
    readonly currentPeriodStart: Date;
    /** End of the active billing period. */
    readonly currentPeriodEnd: Date;
    /**
     * "Now" reference for the proration. Injected so tests can lock the
     * clock; production callers omit and the helper uses `new Date()`.
     */
    readonly now?: Date;
}

/**
 * Prorated upgrade-delta amount, in centavos, that the user should be
 * charged upfront for the change to take effect for the remainder of
 * the current billing period.
 *
 * Formula (SPEC-122 Sub-decision 3):
 *
 *   delta = (target - current) * remaining_ms / total_ms
 *
 * Returned value is rounded to the nearest centavo. Negative or zero
 * values indicate no charge is needed (downgrade, equal-priced swap,
 * or the cycle already ended) — the caller decides what to do in
 * those cases.
 *
 * Defensive against degenerate periods (start >= end) — returns 0
 * rather than throwing, so a corrupted local row cannot 500 the
 * upgrade route.
 */
export function computePlanChangeDelta(input: ComputePlanChangeDeltaInput): number {
    const { currentPriceCentavos, targetPriceCentavos, currentPeriodStart, currentPeriodEnd } =
        input;
    const now = input.now ?? new Date();

    const totalMs = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
    if (totalMs <= 0) {
        return 0;
    }

    const remainingMs = Math.max(0, currentPeriodEnd.getTime() - now.getTime());
    const remainingRatio = Math.min(1, remainingMs / totalMs);

    const deltaPerPeriod = targetPriceCentavos - currentPriceCentavos;
    return Math.round(deltaPerPeriod * remainingRatio);
}

/**
 * Input for {@link initiatePaidMonthlySubscription}.
 *
 * `urls.paymentMethodReturnUrl` and `urls.notificationUrl` are injected
 * by the caller because they depend on env vars (`HOSPEDA_SITE_URL`,
 * `HOSPEDA_API_URL`). Keeping them as inputs makes the service trivially
 * testable: no env mock required.
 */
export interface InitiatePaidMonthlySubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /**
     * The authenticated user's Hospeda user ID (not billing customer ID).
     * Strongly recommended for production — enables the full promo restriction
     * checks (newCustomersOnly + maxPerCustomer + validPlans + expiry + minAmount).
     * When omitted (tests that mock the resolver), the resolver bypasses
     * `validatePromoCode` and goes straight to effect classification.
     * SPEC-262 C1+H1: the route MUST supply this; the resolver uses it for the
     * complete `validatePromoCode` call.
     */
    readonly userId?: string;
    /** Plan slug — matched against `QZPayPlan.name`. */
    readonly planSlug: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        /** MercadoPago `back_url` for the preapproval. */
        readonly paymentMethodReturnUrl: string;
        /** Override webhook destination for this preapproval. */
        readonly notificationUrl: string;
    };
    /**
     * Optional promo code. Resolved via
     * {@link resolveCheckoutPromoPlan} into a trial / discount / comp plan
     * (SPEC-262 T-012 P2). For a customer NOT eligible for the HOS-110
     * no-card trial (see below), the effect applies to the paid checkout:
     *  - `trial_extension` → `freeTrialDays` on the preapproval (delays first charge).
     *  - `discount` → live-preapproval `transaction_amount` mutation (FAIL-CLOSED).
     *  - `comp` → a `status='comp'` subscription, NO MercadoPago preapproval.
     * An unknown / inactive / restricted code surfaces as
     * `SubscriptionCheckoutError('INVALID_PROMO_CODE')`, mapped to HTTP 422,
     * REGARDLESS of trial eligibility (HOS-110 W1: the code is validated
     * before either branch runs). For a trial-eligible customer the promo
     * instead folds into the granted trial — see the TRIAL branch comment
     * in {@link initiatePaidMonthlySubscription} for the full per-`kind`
     * behavior (comp wins over trial; trial_extension lengthens it;
     * discount is discarded and flagged via `promoCodeIgnored`).
     */
    readonly promoCode?: string;
    /** Drizzle client override for tests (comp insert path). */
    readonly db?: DrizzleClient;
}

/**
 * Marker for the checkout effect that was applied, when it changes the response
 * shape. `comp` means NO MercadoPago redirect happened — the subscriber is
 * already active (free-forever) and the front-end goes straight to success.
 * `discount` means the preapproval amount was lowered (a normal MP redirect
 * still follows). `trial` (HOS-110) means the plan's no-card trial was granted
 * instead — the subscriber is `trialing` immediately, NO MercadoPago preapproval
 * was created, and the front-end goes straight to success just like `comp`.
 * Absent when no promo/trial (or a promo trial extension) was applied.
 */
export type CheckoutAppliedEffect = 'comp' | 'discount' | 'trial';

/**
 * Output shape of a successful initiation. Mirrors
 * `StartPaidSubscriptionResponse` from `@repo/schemas` but stays
 * decoupled from the schema package so the service is reusable from
 * non-API contexts (e.g. a CLI seed script).
 *
 * For a `comp` redemption there is NO MercadoPago checkout page, so
 * `checkoutUrl` carries an in-app success sentinel URL and `appliedEffect`
 * is `'comp'`.
 */
export interface InitiatePaidMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
    readonly appliedEffect?: CheckoutAppliedEffect;
    /**
     * HOS-110 W1: set to `true` when a `discount` promo code was supplied
     * alongside a trial-eligible checkout and the code was DISCARDED (not
     * persisted anywhere) because the free trial takes priority over a
     * discount on a not-yet-charged subscription. Only ever present together
     * with `appliedEffect: 'trial'`. Absent (not `false`) in every other
     * case — the front-end should treat "absent" and "false" identically.
     */
    readonly promoCodeIgnored?: true;
}

/**
 * Initiate a paid monthly subscription via qzpay-core's `mode: 'paid'`
 * create flow. The returned subscription is in qzpay's `incomplete`
 * state until the user authorizes the recurring charge in MP and the
 * `subscription_preapproval.created` webhook (SPEC-126 D3) flips it to
 * `active`.
 *
 * @throws SubscriptionCheckoutError When the plan or monthly price is
 *   missing, or when the payment adapter is misconfigured and returns
 *   no init point.
 */
export async function initiatePaidMonthlySubscription(
    input: InitiatePaidMonthlySubscriptionInput
): Promise<InitiatePaidMonthlySubscriptionResult> {
    const { customerId, userId, planSlug, billing, urls, promoCode } = input;

    // Resolve plan first so we can pass planId + monthly price to the full
    // promo validation (validPlans check + minAmount). This also ensures an
    // invalid plan rejects early before the promo is even looked up.
    const plan = await resolvePlanBySlug(billing, planSlug);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    // Testing-only special case (HOSPEDA_SHOW_TEST_BILLING_PLAN): the hidden
    // daily test plan ({@link TEST_DAILY_PLAN}) carries ONLY a `'day'` price
    // — no `'month'` price at all (see its JSDoc in `@repo/billing`). The
    // monthly checkout entry point is reused as-is (the client still sends
    // `billingInterval: 'monthly'`), but for this ONE plan it resolves the
    // DAILY price instead of a monthly one, so the MP preapproval it creates
    // is still billed against the `'day'` price row (see
    // `toMercadoPagoInterval` in `@qazuor/qzpay-mercadopago`). No real plan
    // is ever affected — this branch only matches `TEST_DAILY_PLAN.slug`,
    // which `resolvePlanBySlug` already gates behind the env flag above.
    const monthlyPrice =
        planSlug === TEST_DAILY_PLAN.slug
            ? findDailyPrice(plan.prices)
            : findMonthlyPrice(plan.prices);
    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MONTHLY_PRICE',
            `Plan '${planSlug}' has no active monthly price`
        );
    }

    // Resolve the promo code with FULL validation (SPEC-262 C1+H1), BEFORE
    // deciding trial vs paid (HOS-110 W1 fix). Adversarial review of the
    // original HOS-110 trial branch found it ran before promo resolution,
    // silently dropping ANY `promoCode` supplied by a trial-eligible
    // customer: an invalid code never surfaced as an error, a comp code
    // never took effect, and a trial_extension code's extra days were
    // never applied. Resolving here — before both the comp and trial
    // branches below — fixes all three: an invalid code always throws
    // regardless of trial eligibility, and each branch can react to
    // whatever the code actually is.
    // Pass userId + planId + amount so all restrictions are enforced:
    // expiresAt, maxUses, maxPerCustomer, validPlans, newCustomersOnly, minAmount.
    const promoPlan = await resolveCheckoutPromoPlan({
        promoCode,
        userId,
        planId: plan.id,
        amount: monthlyPrice.unitAmount
    });
    if (promoPlan.kind === 'invalid') {
        throw new SubscriptionCheckoutError('INVALID_PROMO_CODE', promoPlan.message);
    }

    // ── COMP branch ──────────────────────────────────────────────────────────
    // Comp (free-forever) creates a status='comp' subscription directly — NO MP
    // preapproval, NO charge. Checked BEFORE the trial branch (HOS-110 W1): a
    // comp code ALWAYS wins over a trial — there is no reason to burn the
    // customer's one-per-lifetime trial only to immediately shadow it with a
    // free-forever subscription. The response carries an in-app success
    // sentinel URL (reusing the already-resolved return URL, which points at
    // the checkout success page) and appliedEffect='comp' so the front skips
    // the MP redirect.
    if (promoPlan.kind === 'comp') {
        const customer = await billing.customers.get(customerId);
        if (!customer) {
            throw new SubscriptionCheckoutError(
                'CUSTOMER_NOT_FOUND',
                `Customer '${customerId}' not found`
            );
        }
        const comp = await createCompSubscription({
            customerId,
            planId: plan.id,
            promoCodeId: promoPlan.promoCodeId,
            code: promoPlan.code,
            interval: 'monthly',
            livemode: customer.livemode,
            ...(input.db ? { db: input.db } : {})
        });
        return {
            checkoutUrl: urls.paymentMethodReturnUrl,
            localSubscriptionId: comp.localSubscriptionId,
            expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
            appliedEffect: 'comp'
        };
    }

    // ── TRIAL branch (HOS-110, reordered by W1) ─────────────────────────────
    // Unifies the no-card trial across every entry surface that hits
    // `/start-paid` (the public pricing page, the testing daily-plan button —
    // previously only the accommodation-publish flow granted a trial). When
    // the resolved plan declares a trial AND the customer has never had a
    // subscription before, they get enabled immediately (`trialing`, no MP
    // preapproval) instead of being sent straight to MercadoPago.
    //
    // The promo is already resolved above (`comp` already returned and never
    // reaches here) and folds into the granted trial per the HOS-110 W1 owner
    // decision:
    //  - `trial_extension` -> its `freeTrialDays` are forwarded as
    //    `extraTrialDays`, lengthening the granted trial (base + extension).
    //  - `discount` -> the trial wins outright (a free trial beats a discount
    //    on a not-yet-charged sub); the discount is DISCARDED — never
    //    persisted anywhere — and `promoCodeIgnored: true` is returned so the
    //    front-end can tell the user their code was not applied.
    //  - `none` -> unchanged trial, no flag.
    const { hasTrial: planHasTrial, trialDays: planTrialDays } = resolvePlanTrialConfig(
        plan.metadata
    );
    if (planHasTrial && planTrialDays > 0) {
        // First-layer eligibility check: re-fetch the customer's subscriptions
        // (the route already fetched this once for its own ALREADY_SUBSCRIBED /
        // SUBSCRIPTION_CANCEL_PENDING guards; re-fetching here keeps this
        // service self-contained without widening its input contract). Any
        // prior subscription — of any status or product domain — disqualifies
        // a trial (one trial per customer, for life).
        const existingSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const isTrialEligible = existingSubscriptions.length === 0;

        if (isTrialEligible) {
            // Ensure the billing customer record actually exists before creating
            // a trial subscription against it. `BillingCustomerSyncService.
            // ensureCustomerExists` cannot be reused verbatim here: it keys off
            // the Hospeda userId + email (neither available on this service's
            // input), whereas `customerId` here is already the resolved QZPay
            // customer id — so a direct existence check is the correct
            // equivalent (mirrors the identical guard in the `comp` branch above).
            const customer = await billing.customers.get(customerId);
            if (!customer) {
                throw new SubscriptionCheckoutError(
                    'CUSTOMER_NOT_FOUND',
                    `Customer '${customerId}' not found`
                );
            }

            // HOS-110 W1: a trial_extension code adds its days on top of the
            // plan's base trial length; a discount code is discarded (the
            // trial wins as-is) — no extension applies in that case.
            const extraTrialDays = promoPlan.kind === 'trial' ? promoPlan.freeTrialDays : undefined;

            const trialService = new TrialService(billing);
            // `startTrial` is the AUTHORITATIVE eligibility gate — it re-checks
            // for ANY existing subscription itself. `isTrialEligible` above is a
            // cheap first-layer short-circuit, not a substitute: a `null` return
            // here means startTrial itself declined (e.g. a subscription was
            // created concurrently between the two checks) — fall through to the
            // normal paid path unchanged.
            const trialSubscriptionId = await trialService.startTrial({
                customerId,
                planSlug,
                // HOS-115 §5: record the checkout entry interval so the
                // post-trial conversion nudge can pre-select the same toggle.
                intendedInterval: 'monthly',
                ...(extraTrialDays === undefined ? {} : { extraTrialDays })
            });

            if (trialSubscriptionId) {
                const trialSubscription = await billing.subscriptions.get(trialSubscriptionId);
                const effectiveTrialDays = planTrialDays + (extraTrialDays ?? 0);
                const expiresAt = trialSubscription?.trialEnd
                    ? new Date(trialSubscription.trialEnd).toISOString()
                    : new Date(Date.now() + effectiveTrialDays * 24 * 60 * 60 * 1000).toISOString();
                const promoCodeIgnored = promoPlan.kind === 'discount';

                apiLogger.info(
                    {
                        customerId,
                        planSlug,
                        trialSubscriptionId,
                        expiresAt,
                        ...(extraTrialDays ? { extraTrialDays } : {}),
                        ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
                    },
                    'Trial-eligible checkout: granted no-card trial instead of MercadoPago redirect'
                );

                return {
                    checkoutUrl: urls.paymentMethodReturnUrl,
                    localSubscriptionId: trialSubscriptionId,
                    expiresAt,
                    appliedEffect: 'trial',
                    ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
                };
            }
        }
    }

    // SPEC-262 L1: reject a discount that would reduce the monthly price to zero.
    // A 0-amount preapproval is meaningless (MP would reject it) and semantically
    // wrong — the right tool for a free subscription is a comp code, not a 100%
    // discount code. Fail early before the preapproval is created.
    if (promoPlan.kind === 'discount') {
        const mutation = calculatePromoCodeEffect(promoPlan.effect, monthlyPrice.unitAmount);
        if (mutation.type === 'apply-discount' && mutation.finalAmount === 0) {
            throw new SubscriptionCheckoutError(
                'INVALID_PROMO_CODE',
                'This discount code reduces the price to zero. Use a comp code for free subscriptions.'
            );
        }
    }

    // trial_extension forwards freeTrialDays to delay the first recurring charge.
    const freeTrialDays = promoPlan.kind === 'trial' ? promoPlan.freeTrialDays : undefined;

    const subscription: QZPaySubscriptionWithHelpers = await billing.subscriptions.create({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        mode: 'paid',
        billingInterval: 'monthly',
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        // SPEC-126 D9: extra free-trial days are forwarded to the MP
        // preapproval so the first recurring charge is delayed by N days.
        // Omitted when no qualifying promo code was supplied.
        ...(freeTrialDays === undefined ? {} : { freeTrialDays }),
        metadata: {
            source: 'start-paid-monthly',
            createdBy: 'subscription-flow',
            ...(promoCode === undefined ? {} : { promoCode })
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;

    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // ── DISCOUNT branch (SPEC-262 T-012 P2) ───────────────────────────────────
    // The preapproval was created at FULL price. Mutate it down to the discounted
    // amount, FAIL-CLOSED. If MP rejects, cancel the just-created subscription so
    // the payer is never left on a full-price preapproval, then throw a typed
    // error — we MUST NOT return a checkoutUrl for a discount that did not apply.
    let appliedEffect: CheckoutAppliedEffect | undefined;
    if (promoPlan.kind === 'discount') {
        const mpSubscriptionId = subscription.providerSubscriptionIds?.mercadopago;
        if (!mpSubscriptionId) {
            // No live preapproval id to mutate — fail closed (cancel + throw).
            await cancelSubscriptionFailClosed(billing, subscription.id);
            throw new SubscriptionCheckoutError(
                'MISSING_INIT_POINT',
                'Payment provider returned no preapproval id — cannot apply the discount; subscription cancelled.'
            );
        }

        const fullPriceCentavos = await resolveFullPlanPriceCentavos(getDb(), plan.id);
        if (fullPriceCentavos === null) {
            await cancelSubscriptionFailClosed(billing, subscription.id);
            throw new SubscriptionCheckoutError(
                'NO_MONTHLY_PRICE',
                `Could not resolve full plan price for plan '${planSlug}' — discount not applied; subscription cancelled.`
            );
        }

        // applySignupDiscountToMonthly computes the discounted amount from
        // fullPriceCentavos via the pure reducer (single source) and FAIL-CLOSED
        // mutates the live preapproval before committing any DB state.
        const discountResult = await applySignupDiscountToMonthly({
            billing,
            subscriptionId: subscription.id,
            mpSubscriptionId,
            customerId,
            promoCodeId: promoPlan.promoCodeId,
            code: promoPlan.code,
            effect: promoPlan.effect,
            fullPriceCentavos,
            livemode: subscription.livemode ?? false
        });

        if (!discountResult.success) {
            // FAIL-CLOSED: cancel the sub so the payer is not on a full-price
            // preapproval, then surface a typed error. No checkoutUrl returned.
            await cancelSubscriptionFailClosed(billing, subscription.id);
            throw new SubscriptionCheckoutError(
                'DISCOUNT_APPLY_FAILED',
                `MercadoPago rejected the discount and the subscription was cancelled: ${discountResult.error.message}`
            );
        }
        appliedEffect = 'discount';
    }

    // SPEC-143 Finding #17 fallback: enqueue a polling job that will flip
    // the local subscription to `active` if the `subscription_preapproval.created`
    // webhook fails to arrive in time. Webhook still wins the race when it
    // does arrive — the poller treats an already-active subscription as a
    // no-op. The helper handles the env-flag check, missing-storage guard,
    // and error logging.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: subscription.id,
        providerResourceId: subscription.providerSubscriptionIds?.mercadopago ?? '',
        resourceType: 'subscription',
        planSlug,
        sourceLabel: 'start-paid-monthly'
    });

    return {
        checkoutUrl,
        localSubscriptionId: subscription.id,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
        ...(appliedEffect ? { appliedEffect } : {})
    };
}

/**
 * Cancel a just-created subscription as part of the FAIL-CLOSED discount path.
 *
 * Best-effort: a cancel failure is logged (the abandoned-pending cron is the
 * safety net for an orphaned pending row) but must NOT mask the original
 * discount-failure error the caller is about to throw.
 *
 * @internal
 */
async function cancelSubscriptionFailClosed(
    billing: QZPayBilling,
    subscriptionId: string
): Promise<void> {
    try {
        await billing.subscriptions.cancel(subscriptionId);
        apiLogger.warn(
            { subscriptionId },
            'Signup discount: cancelled subscription after MP discount mutation failed (fail-closed)'
        );
    } catch (cancelErr) {
        apiLogger.error(
            {
                subscriptionId,
                error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr)
            },
            'Signup discount: FAILED to cancel subscription after discount mutation failure — abandoned-pending cron will reap it'
        );
    }
}

/**
 * Input for {@link initiateCommerceMonthlySubscription} (SPEC-239 T-048).
 *
 * Mirrors {@link InitiatePaidMonthlySubscriptionInput} but adds the commerce
 * entity coordinates so the function can stamp the new subscription as a
 * commerce-domain sub (D3) and upsert the `commerce_listing_subscriptions`
 * link row (D4). No promo support — commerce listings have no trial promos.
 */
export interface InitiateCommerceMonthlySubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID of the listing owner). */
    readonly customerId: string;
    /** Plan slug — matched against `QZPayPlan.name` (the commerce plan slug). */
    readonly planSlug: string;
    /** Commerce entity discriminator (e.g. `'gastronomy'`). */
    readonly entityType: string;
    /** UUID of the commerce entity being subscribed (gastronomies.id, etc.). */
    readonly entityId: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        readonly paymentMethodReturnUrl: string;
        readonly notificationUrl: string;
    };
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
}

/**
 * Output shape for a commerce subscription initiation. Mirrors the
 * accommodation monthly result so the route returns either uniformly.
 */
export interface InitiateCommerceMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
}

/**
 * Initiate a monthly commerce-listing subscription (SPEC-239 T-048).
 *
 * Reuses the accommodation `mode: 'paid'` MP preapproval flow, then:
 *   1. (D3) stamps `billing_subscriptions.product_domain = 'commerce'` via a
 *      typed Drizzle UPDATE.
 *   2. (D4) upserts the `commerce_listing_subscriptions` link row keyed on the
 *      UNIQUE(entity_type, entity_id) constraint (one link per entity), so a
 *      re-subscription overwrites `subscriptionId` + `status` rather than
 *      inserting a duplicate.
 *
 * The link row is created with `status = subscription.status` (qzpay's
 * `incomplete` until the preapproval webhook activates it). The visibility
 * reconciler flips the listing to PUBLIC once the webhook/cron applies an
 * active status.
 *
 * @throws SubscriptionCheckoutError When the plan or monthly price is missing,
 *   or when the payment adapter returns no init point.
 */
export async function initiateCommerceMonthlySubscription(
    input: InitiateCommerceMonthlySubscriptionInput
): Promise<InitiateCommerceMonthlySubscriptionResult> {
    const { customerId, planSlug, entityType, entityId, billing, urls } = input;

    const plan = await resolvePlanBySlug(billing, planSlug);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);
    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MONTHLY_PRICE',
            `Plan '${planSlug}' has no active monthly price`
        );
    }

    const subscription: QZPaySubscriptionWithHelpers = await billing.subscriptions.create({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        mode: 'paid',
        billingInterval: 'monthly',
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        metadata: {
            source: 'start-commerce-monthly',
            createdBy: 'commerce-subscription-flow',
            productDomain: ProductDomainEnum.COMMERCE,
            entityType,
            entityId
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // D3 + D4 are wrapped in a single transaction so the commerce path can never
    // end up with a billing_subscriptions row stamped 'commerce' but no link row
    // (or vice versa). A partial write would leave the listing unrecoverable: it
    // could never be reconciled to PUBLIC even after the owner pays.
    await withTransaction(async (tx) => {
        // D3: stamp product_domain='commerce' on the freshly-created subscription.
        // (tx reuses a caller-provided boundary via input.db when present.)
        await tx
            .update(billingSubscriptions)
            .set({ productDomain: ProductDomainEnum.COMMERCE })
            .where(eq(billingSubscriptions.id, subscription.id));

        // D4: upsert the commerce_listing_subscriptions link row (one per entity).
        // On the UNIQUE(entity_type, entity_id) conflict, update subscriptionId +
        // status so re-subscribing an entity reuses the same link row.
        await tx
            .insert(commerceListingSubscriptions)
            .values({
                subscriptionId: subscription.id,
                productDomain: ProductDomainEnum.COMMERCE,
                entityType,
                entityId,
                status: subscription.status
            })
            .onConflictDoUpdate({
                target: [
                    commerceListingSubscriptions.entityType,
                    commerceListingSubscriptions.entityId
                ],
                set: {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    updatedAt: new Date()
                }
            });
    }, input.db);

    // Polling fallback — same as the accommodation monthly flow.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: subscription.id,
        providerResourceId: subscription.providerSubscriptionIds?.mercadopago ?? '',
        resourceType: 'subscription',
        planSlug,
        sourceLabel: 'start-commerce-monthly'
    });

    return {
        checkoutUrl,
        localSubscriptionId: subscription.id,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}

export interface InitiatePartnerMonthlySubscriptionInput {
    readonly customerId: string;
    readonly planId: string;
    readonly partnerId: string;
    readonly billing: QZPayBilling;
    readonly urls: {
        readonly paymentMethodReturnUrl: string;
        readonly notificationUrl: string;
    };
    readonly db?: DrizzleClient;
}

export interface InitiatePartnerMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
}

/**
 * Initiate a monthly partner-directory subscription (SPEC-271).
 */
export async function initiatePartnerMonthlySubscription(
    input: InitiatePartnerMonthlySubscriptionInput
): Promise<InitiatePartnerMonthlySubscriptionResult> {
    const { customerId, planId, partnerId, billing, urls } = input;

    const plan = await billing.plans.get(planId);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planId}' not found`);
    }

    const monthlyPrice = findMonthlyPrice(plan.prices);
    if (!monthlyPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MONTHLY_PRICE',
            `Plan '${planId}' has no active monthly price`
        );
    }

    const subscription: QZPaySubscriptionWithHelpers = await billing.subscriptions.create({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        mode: 'paid',
        billingInterval: 'monthly',
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        metadata: {
            source: 'start-partner-monthly',
            createdBy: 'partner-subscription-flow',
            productDomain: ProductDomainEnum.PARTNER,
            partnerId
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    await withTransaction(async (tx) => {
        await tx
            .update(billingSubscriptions)
            .set({ productDomain: ProductDomainEnum.PARTNER })
            .where(eq(billingSubscriptions.id, subscription.id));

        await tx
            .insert(partnerSubscriptions)
            .values({
                subscriptionId: subscription.id,
                productDomain: ProductDomainEnum.PARTNER,
                partnerId,
                status: subscription.status
            })
            .onConflictDoUpdate({
                target: partnerSubscriptions.partnerId,
                set: {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    updatedAt: new Date()
                }
            });
    }, input.db);

    await schedulePollingForSubscription({
        billing,
        subscriptionId: subscription.id,
        providerResourceId: subscription.providerSubscriptionIds?.mercadopago ?? '',
        resourceType: 'subscription',
        planSlug: plan.name,
        sourceLabel: 'start-partner-monthly'
    });

    return {
        checkoutUrl,
        localSubscriptionId: subscription.id,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
    };
}

/**
 * Input for {@link initiatePaidAnnualSubscription}.
 *
 * Annual subscriptions skip MercadoPago's preapproval API entirely:
 * we charge the full annual amount upfront via `billing.checkout`
 * (`mode: 'payment'`) and persist a local `billing_subscriptions`
 * row directly. Because qzpay-core's `subscriptions.create()` path
 * hard-codes monthly billing-interval and a +30d period in the
 * storage adapter, it cannot be parameterized for the annual
 * lifecycle — hence the direct Drizzle insert.
 *
 * `urls` is split into `successUrl` / `cancelUrl` (not the monthly's
 * single `paymentMethodReturnUrl`) because MP's hosted checkout
 * distinguishes both return paths.
 */
export interface InitiatePaidAnnualSubscriptionInput {
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /**
     * The authenticated user's Hospeda user ID (not billing customer ID).
     * Strongly recommended for production — enables the full promo restriction
     * checks. When omitted (tests with a mocked resolver), the resolver bypasses
     * `validatePromoCode`. SPEC-262 C1+H1: the route MUST supply this.
     */
    readonly userId?: string;
    /** Plan slug — matched against `QZPayPlan.name`. */
    readonly planSlug: string;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        /** Where MP sends the user after a successful payment. */
        readonly successUrl: string;
        /** Where MP sends the user if they abandon the checkout. */
        readonly cancelUrl: string;
        /** Webhook destination for this checkout. */
        readonly notificationUrl: string;
    };
    /**
     * Provider-side statement descriptor (cardholder bank statement).
     * MP expects 1-11 ASCII uppercase chars / digits / spaces. When
     * omitted the adapter applies its provider default.
     */
    readonly statementDescriptor?: string;
    /**
     * Optional promo code (SPEC-262 T-012 P2, extended by HOS-115). Annual
     * honors:
     *  - `comp` → a `status='comp'` subscription, NO MercadoPago charge.
     *    Wins outright over a trial (comp always beats trial).
     *  - For a TRIAL-ELIGIBLE customer on a trial-declaring plan (HOS-115),
     *    the promo folds into the granted trial exactly like monthly:
     *    `trial_extension` lengthens it (`freeTrialDays` forwarded as
     *    `extraTrialDays`); `discount` is discarded (trial wins, response
     *    carries `promoCodeIgnored: true`).
     *  - Otherwise (not trial-eligible, or the plan has no trial): `discount`
     *    → a one-time reduced line-item amount (annual is a SINGLE charge, so
     *    there is NO preapproval mutation and NO multi-cycle counter —
     *    forever/multi-cycle semantics do not apply); `trial_extension` is a
     *    no-op (no recurring trial to extend, full price charged).
     * An unknown / inactive code surfaces as INVALID_PROMO_CODE (HTTP 422),
     * regardless of trial eligibility.
     */
    readonly promoCode?: string;
    /**
     * Drizzle client override for tests. Production callers omit it
     * and `getDb()` resolves the runtime client.
     */
    readonly db?: DrizzleClient;
}

/**
 * Output shape of a successful annual initiation. Mirrors the monthly
 * shape so the route handler can return either uniformly. `appliedEffect`
 * is `'comp'` when a comp code short-circuited the MP charge (no real
 * `checkoutUrl`), `'discount'` when the annual line-item was reduced, or
 * (HOS-115) `'trial'` when a trial-eligible customer was granted the
 * no-card trial instead of being charged upfront — mirrors the monthly
 * `InitiatePaidMonthlySubscriptionResult` shape exactly so the two stay
 * symmetric.
 */
export interface InitiatePaidAnnualSubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
    readonly appliedEffect?: CheckoutAppliedEffect;
    /**
     * HOS-115 (mirrors HOS-110 W1 monthly): set to `true` when a `discount`
     * promo code was supplied alongside a trial-eligible annual checkout and
     * the code was DISCARDED (not persisted anywhere) because the free trial
     * takes priority over a discount on a not-yet-charged subscription. Only
     * ever present together with `appliedEffect: 'trial'`. Absent (not
     * `false`) in every other case — the front-end should treat "absent" and
     * "false" identically.
     */
    readonly promoCodeIgnored?: true;
}

/**
 * Initiate a paid annual subscription via qzpay-core's
 * `billing.checkout.create({ mode: 'payment' })` one-time flow. The
 * returned local subscription sits in `pending_provider` until the
 * `payment.updated` webhook (status `approved` / `accredited`) flips
 * it to `active` by matching `metadata.annualSubscriptionId`.
 *
 * Unlike the monthly path, the local row is inserted directly into
 * `billing_subscriptions` (see {@link InitiatePaidAnnualSubscriptionInput}
 * for why qzpay's facade cannot be used here). The
 * `abandoned-pending-subs` cron (SPEC-126 D6) will collect the row if
 * the user never completes the checkout within `PENDING_PROVIDER_TTL_MS`.
 *
 * @throws SubscriptionCheckoutError When the plan, annual price, or
 *   customer is missing, or when the checkout adapter returns no init
 *   point.
 */
export async function initiatePaidAnnualSubscription(
    input: InitiatePaidAnnualSubscriptionInput
): Promise<InitiatePaidAnnualSubscriptionResult> {
    const { customerId, userId, planSlug, billing, urls, statementDescriptor, promoCode } = input;
    const db = input.db ?? getDb();

    // Resolve plan + annual price first so we can pass planId + amount to full
    // promo validation, and so an unknown plan rejects before any promo lookup.
    const plan = await resolvePlanBySlug(billing, planSlug);
    if (!plan) {
        throw new SubscriptionCheckoutError('PLAN_NOT_FOUND', `Plan '${planSlug}' not found`);
    }

    const annualPrice = findAnnualPrice(plan.prices);
    if (!annualPrice) {
        throw new SubscriptionCheckoutError(
            'NO_ANNUAL_PRICE',
            `Plan '${planSlug}' has no active annual price`
        );
    }

    // Resolve the promo plan with FULL validation (SPEC-262 C1+H1).
    // Pass userId + planId + amount so all restrictions are enforced.
    const promoPlan = await resolveCheckoutPromoPlan({
        promoCode,
        userId,
        planId: plan.id,
        amount: annualPrice.unitAmount
    });
    if (promoPlan.kind === 'invalid') {
        throw new SubscriptionCheckoutError('INVALID_PROMO_CODE', promoPlan.message);
    }

    // ── COMP branch ──────────────────────────────────────────────────────────
    // comp = never charged regardless of interval. Create the status='comp'
    // subscription directly and return an in-app success sentinel URL.
    if (promoPlan.kind === 'comp') {
        const compCustomer = await billing.customers.get(customerId);
        if (!compCustomer) {
            throw new SubscriptionCheckoutError(
                'CUSTOMER_NOT_FOUND',
                `Customer '${customerId}' not found`
            );
        }
        const comp = await createCompSubscription({
            customerId,
            planId: plan.id,
            promoCodeId: promoPlan.promoCodeId,
            code: promoPlan.code,
            interval: 'annual',
            livemode: compCustomer.livemode,
            ...(input.db ? { db: input.db } : {})
        });
        return {
            checkoutUrl: urls.successUrl,
            localSubscriptionId: comp.localSubscriptionId,
            expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
            appliedEffect: 'comp'
        };
    }

    // ── TRIAL branch (HOS-115, mirrors the monthly HOS-110/W1 branch) ─────────
    // Closes the last HOS-110 follow-up: the annual entry path previously fell
    // straight through to the upfront charge below with no trial branch at all.
    // The trial object created by `TrialService.startTrial()` is interval-agnostic
    // (no price, no interval) — this is the SAME trial the monthly path grants,
    // just reached from the annual toggle. Inserted here, AFTER the COMP
    // early-return and BEFORE the discount/upfront-charge path, so precedence is
    // identical to monthly: comp wins outright -> trial (if eligible) -> paid.
    //
    // The promo is already resolved above (`comp` already returned and never
    // reaches here) and folds into the granted trial per the SAME HOS-110 W1
    // rules the monthly branch uses:
    //  - `trial_extension` -> its `freeTrialDays` are forwarded as
    //    `extraTrialDays`, lengthening the granted trial (base + extension).
    //  - `discount` -> the trial wins outright; the discount is DISCARDED —
    //    never persisted anywhere — and `promoCodeIgnored: true` is returned so
    //    the front-end can tell the user their code was not applied.
    //  - `none` -> unchanged trial, no flag.
    const { hasTrial: planHasTrial, trialDays: planTrialDays } = resolvePlanTrialConfig(
        plan.metadata
    );
    if (planHasTrial && planTrialDays > 0) {
        // First-layer eligibility check (mirrors monthly): any prior
        // subscription — of any status, interval, or product domain —
        // disqualifies a trial (one trial per customer, for life; see
        // Eligibility in the spec — cross-interval, not per-interval).
        const existingSubscriptions = await billing.subscriptions.getByCustomerId(customerId);
        const isTrialEligible = existingSubscriptions.length === 0;

        if (isTrialEligible) {
            // Ensure the billing customer record actually exists before creating
            // a trial subscription against it (mirrors the COMP branch above and
            // the monthly TRIAL branch's identical guard).
            const trialCustomer = await billing.customers.get(customerId);
            if (!trialCustomer) {
                throw new SubscriptionCheckoutError(
                    'CUSTOMER_NOT_FOUND',
                    `Customer '${customerId}' not found`
                );
            }

            // HOS-110 W1 rule, replicated: a trial_extension code adds its days
            // on top of the plan's base trial length; a discount code is
            // discarded (the trial wins as-is) — no extension applies then.
            const extraTrialDays = promoPlan.kind === 'trial' ? promoPlan.freeTrialDays : undefined;

            const trialService = new TrialService(billing);
            // `startTrial` is the AUTHORITATIVE eligibility gate — it re-checks
            // for ANY existing subscription itself. `isTrialEligible` above is a
            // cheap first-layer short-circuit, not a substitute: a `null` return
            // here means startTrial itself declined (e.g. a subscription was
            // created concurrently between the two checks) — fall through to the
            // normal annual paid path unchanged.
            const trialSubscriptionId = await trialService.startTrial({
                customerId,
                planSlug,
                // HOS-115 §5: record the checkout entry interval so the
                // post-trial conversion nudge can pre-select the same toggle.
                intendedInterval: 'annual',
                ...(extraTrialDays === undefined ? {} : { extraTrialDays })
            });

            if (trialSubscriptionId) {
                const trialSubscription = await billing.subscriptions.get(trialSubscriptionId);
                const effectiveTrialDays = planTrialDays + (extraTrialDays ?? 0);
                const expiresAt = trialSubscription?.trialEnd
                    ? new Date(trialSubscription.trialEnd).toISOString()
                    : new Date(Date.now() + effectiveTrialDays * 24 * 60 * 60 * 1000).toISOString();
                const promoCodeIgnored = promoPlan.kind === 'discount';

                apiLogger.info(
                    {
                        customerId,
                        planSlug,
                        trialSubscriptionId,
                        expiresAt,
                        ...(extraTrialDays ? { extraTrialDays } : {}),
                        ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
                    },
                    'Annual trial-eligible checkout: granted no-card trial instead of upfront MP charge'
                );

                return {
                    // No MP object was created — reuse the already-resolved
                    // success URL as the in-app success sentinel, exactly like
                    // the COMP branch above and the monthly TRIAL branch.
                    checkoutUrl: urls.successUrl,
                    localSubscriptionId: trialSubscriptionId,
                    expiresAt,
                    appliedEffect: 'trial',
                    ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
                };
            }
        }
    }

    // ── DISCOUNT branch (annual = one-time reduced price) ─────────────────────
    // Annual is a SINGLE upfront charge, so a discount is just a one-time reduced
    // line-item amount: compute it via the pure reducer. There is NO preapproval
    // mutation and NO multi-cycle counter — forever/multi-cycle duration on the
    // effect is irrelevant for a one-time charge (documented in the input JSDoc).
    //
    // SPEC-262 L1: reject 0-amount (100% or fixed >= price) discount up front.
    // SPEC-262 C2: redeem BEFORE returning discounted checkoutUrl so the cap gates the price.
    let chargeAmountCentavos = annualPrice.unitAmount;
    let appliedEffect: CheckoutAppliedEffect | undefined;
    if (promoPlan.kind === 'discount') {
        const mutation = calculatePromoCodeEffect(promoPlan.effect, annualPrice.unitAmount);
        if (mutation.type === 'apply-discount') {
            // SPEC-262 L1: 0-amount annual checkout is broken (MP rejects unitAmount=0).
            if (mutation.finalAmount === 0) {
                throw new SubscriptionCheckoutError(
                    'INVALID_PROMO_CODE',
                    'This discount code reduces the price to zero. Use a comp code for free subscriptions.'
                );
            }
            chargeAmountCentavos = mutation.finalAmount;
            appliedEffect = 'discount';
        }
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const localSubscriptionId = crypto.randomUUID();

    // SPEC-262 C2: for annual discount, the redemption GATES the discounted
    // checkout URL — it must succeed before we return ANY discounted price.
    // Unlike the monthly path (where the discount is applied post-preapproval
    // via a mutable mutation), the annual discount is baked into the MP line-item
    // at checkout-create time. If redemption fails (e.g. cap exhausted by a
    // concurrent request), we must NOT return the discounted URL — return a 422.
    //
    // The local sub row is inserted BEFORE the MP checkout but AFTER redemption,
    // so a redemption failure rejects cleanly without any orphan row.
    //
    // Note: validatePromoCode (above) already checked maxUses as a best-effort
    // snapshot. redeemAndRecordUsage below acquires SELECT FOR UPDATE lock —
    // this is the authoritative, race-safe gate (see ADR-019).
    if (promoPlan.kind === 'discount') {
        const { redeemAndRecordUsage } = await import('@repo/service-core');
        const redeemResult = await redeemAndRecordUsage({
            promoCodeId: promoPlan.promoCodeId,
            customerId,
            // localSubscriptionId is not yet in the DB, so we pass it optimistically.
            // If the checkout fails later, the usage row exists but the sub does not —
            // acceptable (the code was consumed; the user should try again without it).
            subscriptionId: localSubscriptionId,
            discountAmount: annualPrice.unitAmount - chargeAmountCentavos,
            currency: 'ARS',
            livemode: customer.livemode
        });
        if (!redeemResult.success) {
            throw new SubscriptionCheckoutError(
                'INVALID_PROMO_CODE',
                `Annual discount code '${promoPlan.code}' could not be redeemed: ${redeemResult.error.message}`
            );
        }
    }

    // Insert the local sub row BEFORE creating the provider checkout so
    // the localSubscriptionId can be embedded in the checkout metadata
    // (the webhook handler matches on it to flip the row to `active`).
    // If the checkout call fails downstream, the row is left in
    // `pending_provider` and the abandoned-pending-subs cron will
    // collect it after the TTL — no manual rollback needed.
    await db.insert(billingSubscriptions).values({
        id: localSubscriptionId,
        customerId,
        planId: plan.id,
        billingInterval: 'year',
        intervalCount: 1,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: 'pending_provider',
        livemode: customer.livemode,
        metadata: {
            source: 'start-paid-annual',
            createdBy: 'subscription-flow',
            planSlug,
            annualPriceId: annualPrice.id,
            billingInterval: 'annual'
        }
    });

    // Stamp promo_code_id on the pending row (best-effort — the redemption
    // record already exists from the gate above; this is purely for the FK
    // audit trail on the subscription row itself).
    if (promoPlan.kind === 'discount') {
        try {
            await db.execute(
                sql`UPDATE billing_subscriptions
                    SET promo_code_id = ${promoPlan.promoCodeId}
                    WHERE id = ${localSubscriptionId}`
            );
        } catch (stampErr) {
            apiLogger.warn(
                { localSubscriptionId, code: promoPlan.code, error: String(stampErr) },
                'Annual discount: failed to stamp promo_code_id (redemption already recorded — non-fatal)'
            );
        }
    }

    // Split customer.name on the first whitespace for MP's payer fields
    // (mirrors the qzpay-core monthly subscription create path).
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                // SPEC-262 T-012 P2: chargeAmountCentavos is the discounted amount
                // when a discount code applied, else the full annual price.
                unitAmount: chargeAmountCentavos,
                currency: 'ARS',
                quantity: 1,
                title: `${getPlanDisplayName(plan)} (Annual)`,
                categoryId: 'services'
            }
        ],
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        customerId,
        customerEmail: customer.email,
        ...(customer.name ? { customerName: customer.name } : {}),
        ...(firstName ? { payerFirstName: firstName } : {}),
        ...(rest.length > 0 ? { payerLastName: rest.join(' ') } : {}),
        notificationUrl: urls.notificationUrl,
        ...(statementDescriptor ? { statementDescriptor } : {}),
        idempotencyKey: localSubscriptionId,
        metadata: {
            annualSubscriptionId: localSubscriptionId,
            planSlug,
            billingInterval: 'annual'
        }
    });

    const checkoutUrl = checkout.providerInitPoint ?? checkout.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // SPEC-143 Finding #21 fallback: enqueue a polling job that flips
    // the local subscription to `active` if the `payment.created`/
    // `payment.updated` webhook for the annual one-time charge fails
    // to arrive (current production state: MP Preferences only deliver
    // legacy IPN, which the marker filter drops as duplicate).
    //
    // `checkout.id` is the LOCAL checkout-session UUID assigned by the
    // qzpay-core orchestrator and propagated to MP as `external_reference`
    // — the cron searches MP payments by that field. The webhook still
    // wins when it does arrive; both call sites go through the
    // idempotent `confirmAnnualSubscription`.
    await schedulePollingForSubscription({
        billing,
        subscriptionId: localSubscriptionId,
        providerResourceId: checkout.id,
        resourceType: 'one_time_payment',
        planSlug,
        sourceLabel: 'start-paid-annual'
    });

    return {
        checkoutUrl,
        localSubscriptionId,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
        ...(appliedEffect ? { appliedEffect } : {})
    };
}

/**
 * Input for {@link initiatePaidPlanUpgrade}.
 *
 * Unlike monthly/annual the caller already has the local subscription
 * id on hand (from the active sub lookup the route does anyway), so
 * we accept it directly instead of re-resolving via
 * `billing.subscriptions.getByCustomerId`. This also makes the test
 * surface simpler — no need to mock a list query just to pick the
 * active row.
 *
 * `billingInterval` uses qzpay-core's enum (`'month'` / `'year'`) and
 * `intervalCount` matches the storage column. The caller is responsible
 * for mapping its public-facing enum (monthly/annual/quarterly/…) into
 * this pair — `plan-change.ts` already has `mapBillingIntervalToQZPay`
 * for that, and reusing it keeps the conversion in one place.
 */
export interface InitiatePaidPlanUpgradeInput {
    /** Local billing customer id (the qzpay customer id). */
    readonly customerId: string;
    /** Local subscription id of the currently-active sub being upgraded. */
    readonly currentSubscriptionId: string;
    /** Target plan id (UUID — from `billing_plans.id`, NOT the slug). */
    readonly newPlanId: string;
    /** Billing interval the upgrade keeps using (e.g. `'month'`). */
    readonly billingInterval: 'month' | 'year';
    /** Interval count (e.g. 1 for monthly, 3 for quarterly). */
    readonly intervalCount: number;
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** URL builders the route already resolved from env. */
    readonly urls: {
        readonly successUrl: string;
        readonly cancelUrl: string;
        readonly notificationUrl: string;
    };
    /** Provider-side statement descriptor (1–11 ASCII chars). */
    readonly statementDescriptor?: string;
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
    /** Clock override for tests (used by `computePlanChangeDelta`). */
    readonly now?: Date;
}

/**
 * Output shape of a successful upgrade initiation. The caller exposes
 * `checkoutUrl` to the front and persists `deltaCentavos` /
 * `newPlanId` for the audit trail. The local subscription id is
 * returned for symmetry with monthly/annual, even though here it is
 * the same id the caller already had (the sub being upgraded).
 */
export interface InitiatePaidPlanUpgradeResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
    readonly newPlanId: string;
    readonly deltaCentavos: number;
}

/**
 * Initiate a paid plan upgrade via a one-time MP checkout for the
 * prorated delta (SPEC-141 D7).
 *
 * Flow:
 *   1. Load the active sub (`currentSubscriptionId`), reject if missing
 *      or `same plan`.
 *   2. Load current + target plans, resolve their price rows for the
 *      sub's billing interval.
 *   3. Compute prorated delta via {@link computePlanChangeDelta}.
 *   4. Reject with `NOT_AN_UPGRADE` when delta ≤ 0 — downgrades have
 *      their own (scheduled) flow in Fase 4.
 *   5. Load the customer for payer fields and `livemode` consistency.
 *   6. Create a one-time MP checkout with metadata
 *      `{ planChangeUpgradeId, oldPlanId, newPlanId, newPriceId,
 *      targetTransactionAmountMajor }` so the
 *      `payment.updated` webhook can finish the transition.
 *
 * IMPORTANT: this function does NOT mutate the local subscription. The
 * change is committed by `confirmPlanUpgrade` in the webhook layer
 * after the user actually pays the delta.
 *
 * @throws SubscriptionCheckoutError When any precondition is missing.
 */
export async function initiatePaidPlanUpgrade(
    input: InitiatePaidPlanUpgradeInput
): Promise<InitiatePaidPlanUpgradeResult> {
    const {
        customerId,
        currentSubscriptionId,
        newPlanId,
        billingInterval,
        intervalCount,
        billing,
        urls,
        statementDescriptor
    } = input;

    const sub = await billing.subscriptions.get(currentSubscriptionId);
    if (!sub) {
        throw new SubscriptionCheckoutError(
            'SUBSCRIPTION_NOT_FOUND',
            `Subscription '${currentSubscriptionId}' not found`
        );
    }

    // SAME_PLAN is true ONLY when both the plan id AND the billing
    // interval+count match the user's current subscription. Allowing the
    // same plan with a different interval enables cycle change flows
    // (monthly ↔ annual on the same tier) — see SPEC-143 T-143-61.
    const currentInterval = sub.interval;
    const currentIntervalCount = sub.intervalCount ?? 1;
    const isSamePlan = sub.planId === newPlanId;
    const isSameInterval =
        currentInterval === billingInterval && currentIntervalCount === intervalCount;
    if (isSamePlan && isSameInterval) {
        throw new SubscriptionCheckoutError(
            'SAME_PLAN',
            'Cannot upgrade to the same plan with the same billing interval'
        );
    }

    const [currentPlan, targetPlan] = await Promise.all([
        billing.plans.get(sub.planId),
        billing.plans.get(newPlanId)
    ]);

    if (!currentPlan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Current plan '${sub.planId}' not found`
        );
    }
    if (!targetPlan) {
        throw new SubscriptionCheckoutError(
            'PLAN_NOT_FOUND',
            `Target plan '${newPlanId}' not found`
        );
    }

    const matchesInterval = (
        wantedInterval: string,
        wantedIntervalCount: number
    ): ((p: {
        billingInterval: string;
        intervalCount?: number | null;
        active: boolean;
    }) => boolean) => {
        return (p) =>
            p.active &&
            p.billingInterval === wantedInterval &&
            (p.intervalCount ?? 1) === wantedIntervalCount;
    };

    // currentPrice MUST be resolved against the user's CURRENT
    // subscription interval — otherwise cycle change flows compute a
    // zero delta (same-plan annual current price === same-plan annual
    // target price) and the upgrade flow rejects with NOT_AN_UPGRADE.
    // The target price keeps using the REQUESTED interval since that
    // is what the user will be billed for going forward.
    const currentPrice = currentPlan.prices.find(
        matchesInterval(currentInterval, currentIntervalCount)
    );
    const targetPrice = targetPlan.prices.find(matchesInterval(billingInterval, intervalCount));

    if (!currentPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MATCHING_PRICE',
            `Current plan has no active price for the subscription's current interval '${currentInterval}'/${currentIntervalCount}`
        );
    }
    if (!targetPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MATCHING_PRICE',
            `Target plan has no active price for interval '${billingInterval}'/${intervalCount}`
        );
    }

    const deltaCentavos = computePlanChangeDelta({
        currentPriceCentavos: currentPrice.unitAmount,
        targetPriceCentavos: targetPrice.unitAmount,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        ...(input.now ? { now: input.now } : {})
    });

    if (deltaCentavos <= 0) {
        throw new SubscriptionCheckoutError(
            'NOT_AN_UPGRADE',
            `Computed delta is ${deltaCentavos}; route caller must handle downgrades separately`
        );
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    // qzpay stores prices in centavos; MP `auto_recurring.transaction_amount`
    // expects major units. We forward MAJOR units in metadata so the
    // webhook handler can pass it straight to paymentAdapter.subscriptions.update
    // without re-deriving it from a DB lookup.
    const targetTransactionAmountMajor = targetPrice.unitAmount / 100;

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                unitAmount: deltaCentavos,
                currency: 'ARS',
                quantity: 1,
                title: `${getPlanDisplayName(targetPlan)} (Upgrade prorated)`,
                categoryId: 'services'
            }
        ],
        successUrl: urls.successUrl,
        cancelUrl: urls.cancelUrl,
        customerId,
        customerEmail: customer.email,
        ...(customer.name ? { customerName: customer.name } : {}),
        ...(firstName ? { payerFirstName: firstName } : {}),
        ...(rest.length > 0 ? { payerLastName: rest.join(' ') } : {}),
        notificationUrl: urls.notificationUrl,
        ...(statementDescriptor ? { statementDescriptor } : {}),
        idempotencyKey: `${currentSubscriptionId}:upgrade:${newPlanId}`,
        metadata: {
            planChangeUpgradeId: currentSubscriptionId,
            oldPlanId: sub.planId,
            newPlanId,
            newPriceId: targetPrice.id,
            targetTransactionAmountMajor,
            deltaCentavos
        }
    });

    const checkoutUrl = checkout.providerInitPoint ?? checkout.providerSandboxInitPoint;
    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    return {
        checkoutUrl,
        localSubscriptionId: currentSubscriptionId,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString(),
        newPlanId,
        deltaCentavos
    };
}

/**
 * Test-only exports for unit-testing the pure helpers without round-
 * tripping through the public initiators.
 */
export const _internals = {
    resolvePlanBySlug,
    findMonthlyPrice,
    findAnnualPrice,
    computePlanChangeDelta
};
