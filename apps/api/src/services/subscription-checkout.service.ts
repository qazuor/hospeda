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

import type { QZPayBilling, QZPayPollingResourceType } from '@qazuor/qzpay-core';
import { TEST_DAILY_PLAN } from '@repo/billing';
import {
    billingSubscriptions,
    commerceListingSubscriptions,
    type DrizzleClient,
    eq,
    partnerSubscriptions,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import {
    calculatePromoCodeEffect,
    resolveCheckoutFreeTrialDays,
    resolvePlanTrialConfig
} from '@repo/service-core';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import {
    buildPreapprovalPlanShareLink,
    resolveCheckoutMpPlanId
} from './billing/mp-plan-provisioning.service.js';
import { createPaidSubscription } from './billing/paid-subscription-create.js';
import type { PendingCheckoutDiscount } from './billing/pending-provider-subscription-create.js';
import { createPendingProviderSubscription } from './billing/pending-provider-subscription-create.js';
import type { SubscriptionCheckoutErrorCode } from './billing/subscription-checkout-error.js';
import { SubscriptionCheckoutError } from './billing/subscription-checkout-error.js';
import { resolveCheckoutPromoPlan } from './subscription-checkout-promo.service.js';
import { createCompSubscription } from './subscription-comp-create.service.js';

export type { SubscriptionCheckoutErrorCode };
// HOS-114 T-002: re-exported from the sibling `billing/subscription-checkout-error.js`
// module (not defined here) so every existing importer of these two symbols
// from THIS file keeps working unchanged. See that module's JSDoc for why the
// error type had to move (avoiding a circular import with `trial.service.ts`).
export { SubscriptionCheckoutError };

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
     * REGARDLESS of trial eligibility (the code is validated before any branch
     * runs). See the TRIAL resolution comment in
     * {@link initiatePaidMonthlySubscription} for the full per-`kind` behavior:
     * comp wins outright; trial_extension lengthens the trial; discount lowers
     * the preapproval amount and now coexists with a trial (HOS-171).
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
 * still follows).
 *
 * A `'trial'` variant existed while trials were granted without a card, because
 * that path created no preapproval and the front-end had to skip the redirect.
 * Card-first (HOS-171) removed it: a trial is now an ordinary preapproval that
 * happens to carry `free_trial`, so it redirects to MercadoPago exactly like any
 * other paid checkout and needs no marker.
 *
 * Absent when no promo was applied, and also when a trial was granted.
 */
export type CheckoutAppliedEffect = 'comp' | 'discount';

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
     * `true` when this checkout granted free trial days — i.e. MercadoPago will
     * defer the first charge rather than take it today.
     *
     * This is NOT an `appliedEffect`. A card-first trial is not an alternative to
     * a paid checkout the way `comp` is: it IS the paid checkout, on the same
     * preapproval, with the first debit pushed out. So it takes the normal MP
     * redirect and carries no effect marker — which is exactly why the signal has
     * to live on its own field.
     *
     * Without it the checkout analytics cannot tell a trial from a plain paid
     * signup (`outcome` would collapse both to `'paid'`), and trial→paid
     * conversion (HOS-130) has no event to build on.
     */
    readonly trialGranted?: true;

    /**
     * Set to `true` when the customer supplied a promo code that ended up doing
     * nothing, so the front-end can say so instead of letting them believe it
     * applied.
     *
     * One case only: a `trial_extension` code when no trial was granted (the
     * plan declares none / the ops kill-switch is on / it is not the customer's
     * first subscription). There is no trial to lengthen.
     *
     * A `discount` alongside a trial is NOT ignored — since HOS-171 the two
     * coexist, so the customer gets the free days and the reduced amount.
     *
     * Absent (not `false`) in every other case — the front-end should treat
     * "absent" and "false" identically.
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

    // ── TRIAL resolution (card-first — HOS-171) ─────────────────────────────
    // There is no longer a separate no-card trial branch. Every subscription,
    // trial or not, goes to MercadoPago as a preapproval; a trial is simply that
    // preapproval carrying `auto_recurring.free_trial`, so MP collects the card
    // on day 1 and defers the first charge to day N.
    //
    // This collapses what used to be two grants at two moments (a no-card trial
    // here, then a `trial_extension` promo's days later at checkout, with
    // nothing summing them) into ONE number decided once, below.
    //
    // The promo is already resolved above (`comp` returned earlier and never
    // reaches here) and folds in:
    //  - `trial_extension` -> its days are added to the plan's base length.
    //  - `discount` -> applied to the preapproval amount, INDEPENDENTLY of the
    //    trial. The two are no longer mutually exclusive (HOS-171): the trial
    //    defers the first charge, the discount lowers what that charge will be.
    //    A trial-eligible customer with a 20%-off code gets their free days AND
    //    20% off from the first charge onward.
    //  - `none` -> plain base trial, no flag.
    const { hasTrial: planHasTrial, trialDays: planTrialDays } = resolvePlanTrialConfig(
        plan.metadata
    );

    // One trial per customer, for life. This check WAS a cheap first-layer
    // short-circuit in front of `TrialService.startTrial`, which re-checked it
    // and was the authoritative gate. `startTrial` is gone, so this is now the
    // single authoritative gate and has no second checker behind it: any prior
    // subscription — any status, any product domain, including cancelled —
    // disqualifies. Only queried when the plan actually declares a trial, since
    // otherwise the answer cannot change the outcome.
    const hasPriorSubscription =
        planHasTrial && planTrialDays > 0
            ? (await billing.subscriptions.getByCustomerId(customerId)).length > 0
            : true;

    const extraTrialDays = promoPlan.kind === 'trial' ? promoPlan.freeTrialDays : undefined;

    const { freeTrialDays, promoExtensionIgnored } = resolveCheckoutFreeTrialDays({
        planHasTrial,
        planTrialDays,
        trialDaysOverride: env.HOSPEDA_TRIAL_DAYS_OVERRIDE,
        extraTrialDays,
        hasPriorSubscription
    });

    // A trial_extension code with no trial to lengthen did nothing — tell the
    // customer rather than silently pocketing it.
    const promoCodeIgnored = promoExtensionIgnored;

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

    // ── Path C: MercadoPago hosted preapproval-plan share link (HOS-191) ─────
    // The API no longer creates the preapproval server-side:
    // `billing.subscriptions.create({ mode: 'paid', providerPriceId })` calls
    // `POST /preapproval` with a `preapproval_plan_id`, and MercadoPago rejects
    // that with "card_token_id is required" unless a card was already
    // tokenized — which this self-serve checkout never does. Instead, resolve
    // (or provision) the MP `preapproval_plan` for this customer's exact
    // trial-day variant, materialize a `pending_provider` local subscription +
    // a `billing_pending_checkouts` correlation row (so the eventual
    // `back_url` redirect / webhook can link the real preapproval — F2/F3, out
    // of scope here), and redirect to MercadoPago's HOSTED share link, where MP
    // itself collects the card.
    const providerPriceId = await resolveCheckoutMpPlanId({
        commercialPlanId: plan.id,
        // E2E test-control scope only (HOS-191 resilience specs) — inert in prod.
        customerId,
        planName: getPlanDisplayName(plan),
        amountCentavos: monthlyPrice.unitAmount,
        currency: monthlyPrice.currency,
        // The hidden TEST_DAILY_PLAN resolves the `'day'` price above (into
        // `monthlyPrice`), so its MP plan must be provisioned on a DAILY cadence —
        // otherwise the plan-based preapproval bills monthly and the fast-cycle QA
        // tool is silently defeated. Real plans on this flow are always monthly.
        billingInterval: planSlug === TEST_DAILY_PLAN.slug ? 'daily' : 'monthly',
        trialDays: freeTrialDays ?? 0,
        // Same URL later used as the preapproval's back_url once the real
        // preapproval exists (F2); MP also requires it on preapproval_plan
        // creation (qzpay-mercadopago 2.5.0).
        backUrl: urls.paymentMethodReturnUrl
    });

    // ── DISCOUNT (deferred, SPEC-262 T-012 P2) ────────────────────────────────
    // Path C creates no preapproval synchronously, so there is nothing to mutate
    // yet. Snapshot the resolved discount on the pending-checkout correlation row
    // instead — F2/F3 applies it as a follow-up mutation once the real
    // preapproval is linked. Reuses `monthlyPrice.unitAmount` — the same amount
    // already validated non-zero by the SPEC-262 L1 guard above — so no second
    // price lookup is needed.
    let pendingDiscount: PendingCheckoutDiscount | undefined;
    if (promoPlan.kind === 'discount') {
        const mutation = calculatePromoCodeEffect(promoPlan.effect, monthlyPrice.unitAmount);
        if (mutation.type === 'apply-discount') {
            pendingDiscount = {
                promoCodeId: promoPlan.promoCodeId,
                finalAmountCentavos: mutation.finalAmount
            };
        }
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const { localSubscriptionId, expiresAt } = await createPendingProviderSubscription({
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        billingInterval: 'monthly',
        mpPreapprovalPlanId: providerPriceId,
        payerEmail: customer.email,
        trialGranted: freeTrialDays !== undefined,
        ...(pendingDiscount ? { pendingDiscount } : {}),
        livemode: customer.livemode
    });

    // No `schedulePollingForSubscription` here — Path C creates no MP resource
    // synchronously, so there is no `providerResourceId` yet to poll. Polling
    // (if still warranted) resumes once F2/F3 links the real preapproval.
    const checkoutUrl = buildPreapprovalPlanShareLink({ mpPreapprovalPlanId: providerPriceId });

    return {
        checkoutUrl,
        localSubscriptionId,
        expiresAt,
        ...(freeTrialDays === undefined ? {} : { trialGranted: true as const }),
        ...(pendingDiscount ? { appliedEffect: 'discount' as const } : {}),
        ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
    };
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

    // AC-7: the `mode: 'paid'` create + checkoutUrl resolution + fail-closed
    // MISSING_INIT_POINT guard live in the shared `createPaidSubscription`
    // helper (`billing/paid-subscription-create.ts`), same as the accommodation
    // and reactivation flows. Pure extraction — no behavior change versus the
    // previous inline block.
    // HOS-191: commerce listings are always no-trial (trialDays: 0); subscribe
    // against the no-trial MP preapproval_plan for uniform plan-based checkout.
    const providerPriceId = await resolveCheckoutMpPlanId({
        commercialPlanId: plan.id,
        // E2E test-control scope only (HOS-191 resilience specs) — inert in prod.
        customerId,
        planName: getPlanDisplayName(plan),
        amountCentavos: monthlyPrice.unitAmount,
        currency: monthlyPrice.currency,
        billingInterval: 'monthly',
        trialDays: 0,
        // Same URL used below as the preapproval's back_url; MP requires it on
        // preapproval_plan creation too (qzpay-mercadopago 2.5.0).
        backUrl: urls.paymentMethodReturnUrl
    });

    const { subscription, checkoutUrl } = await createPaidSubscription({
        billing,
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        providerPriceId,
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

    // HOS-191: partner directory subscriptions are no-trial (trialDays: 0);
    // subscribe against the no-trial MP preapproval_plan.
    const providerPriceId = await resolveCheckoutMpPlanId({
        commercialPlanId: plan.id,
        // E2E test-control scope only (HOS-191 resilience specs) — inert in prod.
        customerId,
        planName: getPlanDisplayName(plan),
        amountCentavos: monthlyPrice.unitAmount,
        currency: monthlyPrice.currency,
        billingInterval: 'monthly',
        trialDays: 0,
        // Same URL used below as the preapproval's back_url; MP requires it on
        // preapproval_plan creation too (qzpay-mercadopago 2.5.0).
        backUrl: urls.paymentMethodReturnUrl
    });

    // AC-7: shared `createPaidSubscription` helper — see the commerce flow above.
    const { subscription, checkoutUrl } = await createPaidSubscription({
        billing,
        customerId,
        planId: plan.id,
        priceId: monthlyPrice.id,
        providerPriceId,
        paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
        notificationUrl: urls.notificationUrl,
        metadata: {
            source: 'start-partner-monthly',
            createdBy: 'partner-subscription-flow',
            productDomain: ProductDomainEnum.PARTNER,
            partnerId
        }
    });

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
 * Annual is NOT a different KIND of checkout anymore. Since HOS-171 it is a
 * recurring MercadoPago preapproval at a 12-month cadence
 * (`frequency: 12, frequency_type: 'months'`), and since HOS-191 it goes through
 * the exact same Path C share-link flow as monthly: no `POST /preapproval` is
 * created server-side (MP rejects a `preapproval_plan_id` build with
 * "card_token_id is required"), the checkout resolves/provisions the annual MP
 * `preapproval_plan`, materializes a `pending_provider` `billing_subscriptions`
 * row plus a `billing_pending_checkouts` correlation row, and redirects the
 * browser to MercadoPago's hosted share link. The real preapproval id is linked
 * back later by the back_url/webhook path (F2/F3). There is no upfront
 * `billing.checkout` `mode:'payment'` charge and no direct-insert-of-an-active-
 * subscription path — those descriptions are obsolete.
 *
 * `urls` still carries `successUrl` / `cancelUrl`. `successUrl` becomes the
 * preapproval's single `back_url` (and is required by MP on `preapproval_plan`
 * creation). `cancelUrl` has no preapproval equivalent — a preapproval has
 * exactly one back_url — and is retained only for the HOS-123 annual
 * reactivation callers that still pass it.
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
     * Optional promo code. Since HOS-171 annual is a recurring preapproval, so
     * it honors codes identically to monthly — there is no annual-specific
     * behavior left:
     *  - `comp` → a `status='comp'` subscription, NO MercadoPago charge. Wins
     *    outright over a trial.
     *  - `trial_extension` → its days are added to the plan's base trial length,
     *    as one `free_trial` on the preapproval. A no-op (flagged via
     *    `promoCodeIgnored`) when no trial is granted — there is nothing to
     *    lengthen.
     *  - `discount` → the preapproval amount is mutated down, FAIL-CLOSED, and
     *    the multi-cycle counter applies exactly as it does for monthly. Coexists
     *    with a trial: the trial defers the first charge, the discount lowers it.
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
     * `true` when this checkout granted free trial days — see the monthly
     * result's note. Annual carries the identical signal because since HOS-171
     * it is the identical mechanism: one preapproval, 12-month cadence.
     */
    readonly trialGranted?: true;
    /**
     * Set to `true` when the customer supplied a promo code that ended up doing
     * nothing. One case only: a `trial_extension` code when no trial was granted.
     *
     * It no longer means "a discount was discarded because the trial took
     * priority" — that precedence is gone (HOS-171). A discount and a trial
     * coexist now: the trial defers the first charge, the discount lowers what
     * that charge will be.
     *
     * Absent (not `false`) in every other case — the front-end should treat
     * "absent" and "false" identically.
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
    const { customerId, userId, planSlug, billing, urls, promoCode } = input;

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

    // ── TRIAL resolution (card-first — HOS-171) ───────────────────────────────
    // Identical to the monthly path, and deliberately so: annual is no longer a
    // different KIND of thing. It is the same preapproval with a 12-month
    // cadence, so it gets the same trial, the same promo precedence and the same
    // single decision point.
    const { hasTrial: planHasTrial, trialDays: planTrialDays } = resolvePlanTrialConfig(
        plan.metadata
    );

    // One trial per customer, for life — cross-interval, not per-interval. This
    // is the single authoritative gate now that `TrialService.startTrial` (which
    // used to re-check it) is gone.
    const hasPriorSubscription =
        planHasTrial && planTrialDays > 0
            ? (await billing.subscriptions.getByCustomerId(customerId)).length > 0
            : true;

    const extraTrialDays = promoPlan.kind === 'trial' ? promoPlan.freeTrialDays : undefined;

    const { freeTrialDays, promoExtensionIgnored } = resolveCheckoutFreeTrialDays({
        planHasTrial,
        planTrialDays,
        trialDaysOverride: env.HOSPEDA_TRIAL_DAYS_OVERRIDE,
        extraTrialDays,
        hasPriorSubscription
    });

    // A trial_extension code with no trial to lengthen did nothing — tell the
    // customer rather than silently pocketing it.
    const promoCodeIgnored = promoExtensionIgnored;

    // SPEC-262 L1: reject a discount that would reduce the price to zero. A
    // 0-amount preapproval is meaningless (MP rejects it) and semantically wrong
    // — the right tool for a free subscription is a comp code.
    if (promoPlan.kind === 'discount') {
        const mutation = calculatePromoCodeEffect(promoPlan.effect, annualPrice.unitAmount);
        if (mutation.type === 'apply-discount' && mutation.finalAmount === 0) {
            throw new SubscriptionCheckoutError(
                'INVALID_PROMO_CODE',
                'This discount code reduces the price to zero. Use a comp code for free subscriptions.'
            );
        }
    }

    // ── Path C: MercadoPago hosted preapproval-plan share link (HOS-191) ─────
    // Same rationale as the monthly path above — no preapproval is created
    // server-side (MP rejects `POST /preapproval` built from a
    // `preapproval_plan_id` with "card_token_id is required" unless a card was
    // already tokenized). Resolve/provision the MP plan for this trial-day
    // variant, materialize a `pending_provider` local subscription + a
    // correlation row, and redirect to MercadoPago's hosted share link.
    //
    // `urls.successUrl` is the preapproval's single `back_url` once the real
    // preapproval exists (F2). It resolves to the same checkout success page
    // the monthly path's `paymentMethodReturnUrl` already points at.
    // `urls.cancelUrl` has no equivalent — a preapproval has exactly one
    // back_url — and is retained on the input only for the annual
    // reactivation callers that still pass it and die with HOS-123.
    const providerPriceId = await resolveCheckoutMpPlanId({
        commercialPlanId: plan.id,
        // E2E test-control scope only (HOS-191 resilience specs) — inert in prod.
        customerId,
        planName: getPlanDisplayName(plan),
        amountCentavos: annualPrice.unitAmount,
        currency: annualPrice.currency,
        billingInterval: 'annual',
        trialDays: freeTrialDays ?? 0,
        // Same URL later used as the preapproval's back_url once the real
        // preapproval exists; MP also requires it on preapproval_plan creation
        // (qzpay-mercadopago 2.5.0).
        backUrl: urls.successUrl
    });

    // ── DISCOUNT (deferred) ───────────────────────────────────────────────────
    // Same reasoning as monthly: no preapproval exists yet to mutate, so the
    // resolved discount is snapshotted on the pending-checkout correlation row
    // for F2/F3 to apply once the real preapproval is linked.
    let pendingDiscount: PendingCheckoutDiscount | undefined;
    if (promoPlan.kind === 'discount') {
        const mutation = calculatePromoCodeEffect(promoPlan.effect, annualPrice.unitAmount);
        if (mutation.type === 'apply-discount') {
            pendingDiscount = {
                promoCodeId: promoPlan.promoCodeId,
                finalAmountCentavos: mutation.finalAmount
            };
        }
    }

    const customer = await billing.customers.get(customerId);
    if (!customer) {
        throw new SubscriptionCheckoutError(
            'CUSTOMER_NOT_FOUND',
            `Customer '${customerId}' not found`
        );
    }

    const { localSubscriptionId, expiresAt } = await createPendingProviderSubscription({
        customerId,
        planId: plan.id,
        priceId: annualPrice.id,
        billingInterval: 'annual',
        mpPreapprovalPlanId: providerPriceId,
        payerEmail: customer.email,
        trialGranted: freeTrialDays !== undefined,
        ...(pendingDiscount ? { pendingDiscount } : {}),
        livemode: customer.livemode
    });

    // No `schedulePollingForSubscription` here — see the monthly path's
    // identical note: Path C creates no MP resource synchronously.
    const checkoutUrl = buildPreapprovalPlanShareLink({ mpPreapprovalPlanId: providerPriceId });

    return {
        checkoutUrl,
        localSubscriptionId,
        expiresAt,
        ...(freeTrialDays === undefined ? {} : { trialGranted: true as const }),
        ...(pendingDiscount ? { appliedEffect: 'discount' as const } : {}),
        ...(promoCodeIgnored ? { promoCodeIgnored: true } : {})
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
