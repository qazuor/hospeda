/**
 * Shared low-level paid-subscription-create helper (HOS-114 T-002).
 *
 * Extracted verbatim from `initiatePaidMonthlySubscription`
 * (`subscription-checkout.service.ts:657-683`) so the exact `mode: 'paid'`
 * MercadoPago preapproval contract — `billing.subscriptions.create({
 * mode: 'paid', ... })`, the `providerInitPoint` / `providerSandboxInitPoint`
 * resolution, and the fail-closed `MISSING_INIT_POINT` guard — has exactly
 * ONE implementation. Both the first-subscription checkout flow
 * (`initiatePaidMonthlySubscription`) and the paid-reactivation flow
 * (`TrialService.reactivateFromTrial` / `reactivateSubscription`, HOS-114
 * T-004+) call this helper instead of duplicating the create block.
 *
 * Deliberately low-level (HOS-114 spec §6.2): it does NOT resolve a plan by
 * slug, does NOT run promo/trial logic, and does NOT enforce any
 * "already subscribed" guard. Callers resolve a concrete `planId` +
 * `priceId` first and pass them in — this is what lets a slug-keyed caller
 * (checkout, which resolves via `resolvePlanBySlug`) and a UUID-keyed caller
 * (reactivation, which carries `planId` directly) share the same helper
 * without either owning the other's identifier space.
 *
 * @module services/billing/paid-subscription-create
 */

import type { QZPayBilling, QZPaySubscriptionWithHelpers } from '@qazuor/qzpay-core';
import { applyTestControl } from '@repo/billing';
import { apiLogger } from '../../utils/logger.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Input for {@link createPaidSubscription}.
 */
export interface CreatePaidSubscriptionInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Hospeda billing customer ID (the qzpay customer ID). */
    readonly customerId: string;
    /**
     * Resolved qzpay plan ID (`billing_plans.id`, a UUID). The caller is
     * responsible for resolving this beforehand — by slug (checkout) or by
     * whatever identifier its own contract carries (reactivation) — this
     * helper never looks a plan up itself.
     */
    readonly planId: string;
    /** Resolved qzpay price ID (`billing_prices.id`) for {@link planId}. */
    readonly priceId: string;
    /**
     * Billing cadence for the preapproval. Defaults to `'monthly'`.
     *
     * `'annual'` is mapped by qzpay to MercadoPago's
     * `frequency: 12, frequency_type: 'months'` — NOT `frequency_type: 'years'`,
     * which MercadoPago rejects outright. 12 months is also preferable to the
     * 365 days that would otherwise work: it handles leap years and keeps the
     * renewal aligned to the calendar instead of drifting a day every four
     * years (HOS-171 §7.2).
     */
    readonly billingInterval?: 'monthly' | 'annual';
    /** MercadoPago `back_url` for the preapproval. */
    readonly paymentMethodReturnUrl: string;
    /** Webhook destination for this preapproval. */
    readonly notificationUrl: string;
    /**
     * Extra free-trial days to delay the first recurring charge
     * (SPEC-126 D9). Omitted for a plain paid create with no promo effect.
     */
    readonly freeTrialDays?: number;
    /** Arbitrary metadata attached to the created subscription/preapproval. */
    readonly metadata?: Readonly<Record<string, string>>;
}

/**
 * Result of a successful {@link createPaidSubscription} call. `checkoutUrl`
 * is guaranteed non-empty: the helper throws
 * {@link SubscriptionCheckoutError} (`MISSING_INIT_POINT`) instead of ever
 * returning a result with no checkout URL.
 */
export interface CreatePaidSubscriptionResult {
    /**
     * The just-created qzpay subscription record. Remains `incomplete`
     * until the `subscription_preapproval.created` webhook confirms it.
     */
    readonly subscription: QZPaySubscriptionWithHelpers;
    /** MercadoPago checkout URL the caller must redirect the user to. */
    readonly checkoutUrl: string;
}

/**
 * Create a `mode: 'paid'` qzpay subscription (a real MercadoPago
 * preapproval) and resolve its checkout URL.
 *
 * Extracted verbatim from `initiatePaidMonthlySubscription`
 * (`subscription-checkout.service.ts:657-683`, HOS-114 T-002) — no behavior
 * change versus the original inline block.
 *
 * @param input - Resolved billing instance, customer/plan/price ids, return
 *   URLs, and optional trial/metadata.
 * @returns The created subscription plus its non-empty checkout URL.
 * @throws SubscriptionCheckoutError With code `MISSING_INIT_POINT` when the
 *   payment adapter returns neither a live nor a sandbox init point.
 * @throws SubscriptionCheckoutError With code `MISSING_PROVIDER_SUBSCRIPTION_ID`
 *   (HOS-151 Bug C) when MercadoPago returns a 2xx preapproval with no provider
 *   subscription id. The just-created local row is cancelled (best-effort)
 *   before the throw so no unlinkable `incomplete` row survives.
 *
 * @example
 * ```ts
 * const { subscription, checkoutUrl } = await createPaidSubscription({
 *   billing,
 *   customerId,
 *   planId: plan.id,
 *   priceId: monthlyPrice.id,
 *   paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
 *   notificationUrl: urls.notificationUrl,
 *   metadata: { source: 'start-paid-monthly' }
 * });
 * ```
 */
export async function createPaidSubscription(
    input: CreatePaidSubscriptionInput
): Promise<CreatePaidSubscriptionResult> {
    const {
        billing,
        customerId,
        planId,
        priceId,
        paymentMethodReturnUrl,
        notificationUrl,
        freeTrialDays,
        billingInterval = 'monthly',
        metadata
    } = input;

    // The preapproval create is wrapped in the E2E test-control seam so the
    // resilience suite can force the provider to be down or time out at exactly
    // this point — a failure the real MP sandbox cannot produce on demand. It is
    // wired HERE rather than at each caller because every paid checkout funnels
    // through this one call (monthly, annual and reactivation), so one seam covers
    // all three. Inert in production: `applyTestControl` returns `realCall()`
    // untouched unless HOSPEDA_QZPAY_TEST_CONTROL_ENABLED === 'true'.
    //
    // Scoped by `customerId` so parallel E2E workers sharing the global queue do
    // not consume each other's armed failures (`extractScope`, @repo/billing).
    const subscription = (await applyTestControl('createSubscription', { customerId, planId }, () =>
        billing.subscriptions.create({
            customerId,
            planId,
            priceId,
            mode: 'paid',
            billingInterval,
            paymentMethodReturnUrl,
            notificationUrl,
            // SPEC-126 D9: extra free-trial days are forwarded to the MP
            // preapproval so the first recurring charge is delayed by N days.
            // Omitted when the caller has no qualifying trial extension.
            ...(freeTrialDays === undefined ? {} : { freeTrialDays }),
            ...(metadata === undefined ? {} : { metadata })
        })
    )) as QZPaySubscriptionWithHelpers;

    const checkoutUrl = subscription.providerInitPoint ?? subscription.providerSandboxInitPoint;

    if (!checkoutUrl) {
        throw new SubscriptionCheckoutError(
            'MISSING_INIT_POINT',
            'Payment provider did not return a checkout URL'
        );
    }

    // HOS-151 Bug C: a 2xx preapproval with no provider subscription id is
    // unrecoverable — the webhook lookup keys on `mpSubscriptionId`, so a row
    // persisted with an empty id can never activate and its preapproval can
    // never be located to cancel. Fail loudly instead of leaving an orphan.
    // Clean up the just-created local row best-effort first (mirrors the
    // `cancelSubscriptionFailClosed` fail-closed pattern in
    // subscription-checkout.service.ts); the abandoned-pending cron is the
    // backstop if the cancel does not take effect.
    const mpSubscriptionId = subscription.providerSubscriptionIds?.mercadopago;
    if (!mpSubscriptionId) {
        try {
            await billing.subscriptions.cancel(subscription.id);
            apiLogger.warn(
                { subscriptionId: subscription.id },
                'HOS-151 Bug C: cancelled subscription created with an empty provider id (fail-closed)'
            );
        } catch (cancelErr) {
            apiLogger.error(
                {
                    subscriptionId: subscription.id,
                    error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr)
                },
                'HOS-151 Bug C: FAILED to cancel subscription created with an empty provider id — abandoned-pending cron will reap it'
            );
        }
        throw new SubscriptionCheckoutError(
            'MISSING_PROVIDER_SUBSCRIPTION_ID',
            'Payment provider returned no subscription id — cannot link the preapproval; subscription cancelled.'
        );
    }

    return { subscription, checkoutUrl };
}
