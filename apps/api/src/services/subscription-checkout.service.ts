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

import type { QZPayBilling, QZPaySubscriptionWithHelpers } from '@qazuor/qzpay-core';
import { resolveFreeTrialExtensionPromo } from '@repo/billing';
import { type DrizzleClient, billingSubscriptions, getDb } from '@repo/db';

/**
 * Time-to-live applied to a `pending_provider` subscription before the
 * `abandoned-pending-subs` cron (SPEC-126 D6) flips it to `abandoned`.
 * Exported so callers can reference the same constant when building
 * messages or schedules that should agree with the reaper.
 */
export const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

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
    | 'NOT_AN_UPGRADE';

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
 */
async function resolvePlanBySlug(billing: QZPayBilling, planSlug: string) {
    const plansResult = await billing.plans.list();
    return plansResult.data.find((p) => p.name === planSlug) ?? null;
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
     * Optional promo code (SPEC-126 D9). Currently only
     * `type: 'free_trial_extension'` promos are honored — they translate
     * to `freeTrialDays` on the qzpay subscription create input. An
     * unknown or non-extension code surfaces as
     * `SubscriptionCheckoutError('INVALID_PROMO_CODE')`, which the route
     * maps to HTTP 422.
     */
    readonly promoCode?: string;
}

/**
 * Output shape of a successful initiation. Mirrors
 * `StartPaidSubscriptionResponse` from `@repo/schemas` but stays
 * decoupled from the schema package so the service is reusable from
 * non-API contexts (e.g. a CLI seed script).
 */
export interface InitiatePaidMonthlySubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
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
    const { customerId, planSlug, billing, urls, promoCode } = input;

    // Resolve the promo code BEFORE the qzpay call so an invalid code does
    // not leave a half-created subscription behind. For monthly subs, the
    // only honored type is `free_trial_extension` (SPEC-126 D9 + master
    // plan Decision 4); discount-type promos must be rejected here.
    let freeTrialDays: number | undefined;
    if (promoCode !== undefined && promoCode.length > 0) {
        const resolved = resolveFreeTrialExtensionPromo(promoCode);
        if (!resolved) {
            throw new SubscriptionCheckoutError(
                'INVALID_PROMO_CODE',
                `Promo code '${promoCode}' is not a valid free-trial extension`
            );
        }
        freeTrialDays = resolved.extraTrialDays;
    }

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
        // SPEC-126 D9: extra free-trial days are forwarded to the MP
        // preapproval so the first recurring charge is delayed by N days.
        // Omitted when no qualifying promo code was supplied.
        ...(freeTrialDays !== undefined ? { freeTrialDays } : {}),
        metadata: {
            source: 'start-paid-monthly',
            createdBy: 'subscription-flow',
            ...(promoCode !== undefined ? { promoCode } : {})
        }
    });

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;

    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

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
     * Drizzle client override for tests. Production callers omit it
     * and `getDb()` resolves the runtime client.
     */
    readonly db?: DrizzleClient;
}

/**
 * Output shape of a successful annual initiation. Mirrors the monthly
 * shape so the route handler can return either uniformly.
 */
export interface InitiatePaidAnnualSubscriptionResult {
    readonly checkoutUrl: string;
    readonly localSubscriptionId: string;
    readonly expiresAt: string;
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
    const { customerId, planSlug, billing, urls, statementDescriptor } = input;
    const db = input.db ?? getDb();

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

    // Split customer.name on the first whitespace for MP's payer fields
    // (mirrors the qzpay-core monthly subscription create path).
    const [firstName, ...rest] = (customer.name ?? '').trim().split(/\s+/);

    const checkout = await billing.checkout.create({
        mode: 'payment',
        lineItems: [
            {
                unitAmount: annualPrice.unitAmount,
                currency: 'ARS',
                quantity: 1,
                title: `${plan.name} (Annual)`,
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

    return {
        checkoutUrl,
        localSubscriptionId,
        expiresAt: new Date(Date.now() + PENDING_PROVIDER_TTL_MS).toISOString()
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

    if (sub.planId === newPlanId) {
        throw new SubscriptionCheckoutError('SAME_PLAN', 'Cannot upgrade to the same plan');
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

    const matchesInterval = (p: {
        billingInterval: string;
        intervalCount?: number | null;
        active: boolean;
    }) =>
        p.active &&
        p.billingInterval === billingInterval &&
        (p.intervalCount ?? 1) === intervalCount;

    const currentPrice = currentPlan.prices.find(matchesInterval);
    const targetPrice = targetPlan.prices.find(matchesInterval);

    if (!currentPrice) {
        throw new SubscriptionCheckoutError(
            'NO_MATCHING_PRICE',
            `Current plan has no active price for interval '${billingInterval}'/${intervalCount}`
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
                title: `${targetPlan.name} (Upgrade prorated)`,
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
