/**
 * Recurring add-on checkout (HOS-847 PR 4).
 *
 * Creates a MercadoPago **preapproval of its own** for an add-on whose
 * `billingType` is `'recurring'`, instead of the one-time `Preference` the
 * add-on path has always used. Lives in its own module rather than inside
 * `addon.checkout.ts` because that file is already far past the 500-line limit
 * and because the whole branch is dark: nothing here runs unless
 * `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` is the literal string `'true'`.
 *
 * Two siblings carry the halves that are not creation:
 * `addon.checkout.recurring-resolve.ts` (may this be sold recurringly, at which
 * plan/price, bound to which email) and
 * `addon.checkout.recurring-idempotency.ts` (what to do about a checkout the
 * same buyer already has in flight).
 *
 * ## Why a second preapproval and not a line item
 *
 * A MercadoPago preapproval carries exactly ONE
 * `auto_recurring.transaction_amount` and no `items[]` array (verified against
 * `@qazuor/qzpay-mercadopago`'s `PreApprovalUpdateBody`, which has no item
 * field at all, in contrast with `Preference`). There is no way to attach a
 * charge to an existing preapproval, so a recurring add-on needs a preapproval
 * of its own — and, transitively, its own `preapproval_plan`, which PR 3's
 * {@link resolveCheckoutMpAddonPlanId} provisions and caches.
 *
 * ## Why `billing.checkout.create({ mode: 'subscription' })` is NOT that path
 *
 * All three qzpay checkout modes end in MercadoPago's **Preference** API — a
 * one-time payment. `'subscription'` merely reads the `preapproval_plan` to
 * display a price; it never calls `/preapproval`. Flipping the existing
 * `mode: 'payment'` literal would type-check, look fixed, and still charge
 * once. The preapproval is created only by `billing.subscriptions.create({
 * mode: 'paid' })`, which is what {@link createOwnPreapprovalSubscription}
 * wraps.
 *
 * ## What this module deliberately does NOT do
 *
 * **Nothing is granted here.** No limit increase, no entitlement, no
 * `status = 'active'`. The purchase row is born `'pending'` and the benefit is
 * applied by the webhook (PR 5). That is the same rule qzpay's
 * `mode: 'paid' -> incomplete` insert enforces for plan subscriptions, and for
 * the same reason: anyone who abandons MercadoPago's authorization page would
 * otherwise walk away with the add-on for free.
 *
 * @module services/addon.checkout.recurring
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import type { ServiceResult } from '@repo/service-core';
import { isBillingProviderError } from '../lib/billing-provider-error.js';
import { apiLogger } from '../utils/logger.js';
import { resolveRecurringAddonCheckoutIdempotency } from './addon.checkout.recurring-idempotency.js';
import {
    RECURRING_ADDON_BILLING_INTERVAL,
    RECURRING_ADDON_CHECKOUT_TTL_MS,
    RECURRING_ADDON_LOCAL_TRIAL_DAYS,
    RECURRING_ADDON_PENDING_STATUS,
    resolveAddonPayerEmail,
    resolveSubscriptionPlanReference
} from './addon.checkout.recurring-resolve.js';
import { resolveCheckoutMpAddonPlanId } from './billing/mp-addon-plan-provisioning.service.js';
import { createOwnPreapprovalSubscription } from './billing/own-preapproval-subscription-create.js';
import { SubscriptionCheckoutError } from './billing/subscription-checkout-error.js';

/**
 * Input for {@link createRecurringAddonCheckout}.
 */
export interface CreateRecurringAddonCheckoutInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** The add-on being bought, as resolved from the catalog by the caller. */
    readonly addon: AddonDefinition;
    /** Hospeda billing customer id (the qzpay customer id). */
    readonly customerId: string;
    /**
     * `billing_customers.email` — the signup address, and the last tier of the
     * payer-email precedence (see {@link resolveAddonPayerEmail}).
     */
    readonly customerEmail: string;
    /** Buyer's user id, carried for tracing and for the webhook's context. */
    readonly userId: string;
    /**
     * The customer's REAL plan subscription — the one the domain gate in
     * `createAddonCheckout` already resolved for this add-on's product domain,
     * never another add-on's preapproval row.
     *
     * BOTH halves are load-bearing and they go to different places:
     *  - `planId` is borrowed as the local `plan_id` of the add-on's own
     *    subscription row (see {@link resolveSubscriptionPlanReference});
     *  - `id` is written to `billing_addon_purchases.subscription_id`, which is
     *    the column every downstream reader interprets as "the plan
     *    subscription this add-on runs on top of".
     */
    readonly planSubscription: { readonly id: string; readonly planId: string };
    /** Human-traceable order id, already minted by the caller. */
    readonly orderId: string;
    /** MercadoPago `back_url` — the localized add-on success page. */
    readonly successUrl: string;
    /** Webhook destination for this preapproval. */
    readonly notificationUrl: string;
    /** Target accommodation, for a `requiresAccommodationTarget` add-on. */
    readonly accommodationId?: string | undefined;
}

/**
 * Shape a recurring add-on checkout returns — identical to the one-time path's
 * `PurchaseAddonResult`, so the route and the web client need no branch.
 */
export interface RecurringAddonCheckoutResult {
    readonly checkoutUrl: string;
    readonly orderId: string;
    readonly addonId: string;
    readonly amount: number;
    readonly currency: string;
    readonly expiresAt: string;
}

/**
 * Insert the `billing_addon_purchases` row backing a recurring add-on, in
 * `'pending'`.
 *
 * Deliberately a plain INSERT with no entitlement work and no `'active'`
 * status: the partial unique index `idx_addon_purchases_active_unique` only
 * covers `status = 'active'`, so nothing downstream reads a pending row as a
 * granted benefit. That the index also does not stop a SECOND pending row is
 * exactly why `resolveRecurringAddonCheckoutIdempotency` runs before this.
 *
 * @returns The new row's id.
 */
async function insertPendingRecurringPurchase(input: {
    readonly customerId: string;
    readonly planSubscriptionId: string;
    readonly addon: AddonDefinition;
    readonly mpSubscriptionId: string;
    readonly orderId: string;
    readonly userId: string;
    readonly accommodationId?: string | undefined;
}): Promise<string> {
    const { getDb } = await import('@repo/db');
    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

    const [inserted] = await getDb()
        .insert(billingAddonPurchases)
        .values({
            customerId: input.customerId,
            // The customer's PLAN subscription, NOT the add-on's own
            // preapproval row. This column means "the subscription this add-on
            // runs on top of", and four readers depend on that meaning:
            // `addon-lifecycle-cancellation.service.ts` (revoke every add-on
            // when the plan is cancelled), `billing/admin/qzpay-admin-hooks.ts`
            // (twice), and the orphan phase of `cron/jobs/addon-expiry.job.ts`,
            // which INNER JOINs on it. Writing the add-on's own subscription id
            // here makes all four find zero rows: the plan gets cancelled, the
            // limit stays granted forever, and — once PR 6 hangs the MercadoPago
            // hard-cancel off that same query — the add-on's preapproval is
            // never cancelled and keeps charging. That is risk R1 / HOS-751.
            // The add-on's own preapproval is reachable through
            // `mp_subscription_id` below, which is its proper home.
            subscriptionId: input.planSubscriptionId,
            addonSlug: input.addon.slug,
            addonId: input.addon.id ?? null,
            status: RECURRING_ADDON_PENDING_STATUS,
            purchasedAt: new Date(),
            // NULL on purpose. `expires_at` is the one-time add-on's fixed
            // window (`durationDays`); a recurring purchase ends when its
            // preapproval does, which is what `current_period_end` tracks —
            // and that value is computed from the CONFIRMED charge in PR 5,
            // never copied from MercadoPago's `next_payment_date` (HOS-1012).
            expiresAt: null,
            mpSubscriptionId: input.mpSubscriptionId,
            billingInterval: RECURRING_ADDON_BILLING_INTERVAL,
            limitAdjustments: [],
            entitlementAdjustments: [],
            metadata: {
                orderId: input.orderId,
                userId: input.userId,
                ...(input.accommodationId === undefined
                    ? {}
                    : { accommodationId: input.accommodationId })
            }
        })
        .returning({ id: billingAddonPurchases.id });

    if (!inserted) {
        throw new Error('billing_addon_purchases insert returned no row');
    }

    return inserted.id;
}

/**
 * Create the MercadoPago preapproval backing a recurring add-on purchase and
 * record it locally as `'pending'`.
 *
 * Sequence, and why it is ordered this way:
 *  1. Resolve (provisioning on first use) the add-on's own
 *     `preapproval_plan` — at the catalog LIST price, never a discounted one.
 *  2. Settle anything already in flight for this buyer + add-on: hand back the
 *     SAME checkout when it is still live, or close it before opening another.
 *  3. Resolve the `(planId, priceId)` qzpay needs, plus the binding payer email.
 *  4. Create the preapproval via {@link createOwnPreapprovalSubscription},
 *     stamping `product_domain = 'addon'` so every sweep that assumes one
 *     subscription row per customer skips it, plus `metadata.addonSlug` so the
 *     webhook can tell what was bought.
 *  5. Insert the `'pending'` purchase row carrying `mp_subscription_id`.
 *
 * Step 1 precedes step 2 because the idempotency check needs the resolved
 * MercadoPago plan to tell a reusable checkout from one whose price has since
 * drifted; the resolver is cached and idempotent (PR 3), so calling it first
 * costs nothing.
 *
 * Step 5 is fail-closed: if the local insert fails, the preapproval created in
 * step 4 is cancelled best-effort before the error is returned. A live
 * preapproval with no local row is the HOS-751 failure mode (a provider that
 * keeps charging for something nobody can see), and it is worse here than for a
 * plan, because PR 2 deliberately excluded add-on-domain rows from
 * `abandoned-pending-subs` — nothing else would reap it until PR 7's
 * reconciler exists.
 *
 * @param input - Billing instance, catalog add-on, customer/plan context, URLs.
 * @returns The checkout URL and order details, or a typed service error.
 */
export async function createRecurringAddonCheckout(
    input: CreateRecurringAddonCheckoutInput
): Promise<ServiceResult<RecurringAddonCheckoutResult>> {
    const { billing, addon, customerId, userId, planSubscription, orderId } = input;

    // A blank `addonId` must die HERE. `resolveOrProvisionMpAddonPlan` refuses
    // it for a measured reason (Drizzle's clause builder DROPS `undefined`
    // keys, so a two-column lookup silently degrades to one and returns ANOTHER
    // add-on's MP plan), but that refusal arrives as a 502-shaped provider
    // error. Catching it here says the true thing instead: this catalog row has
    // no primary key, so it cannot be sold recurringly at all.
    //
    // Unreachable through `createAddonCheckout`, on purpose:
    // `shouldUseRecurringAddonCheckout` also fails closed on a missing id,
    // because it cannot read the row's real `billing_interval` without one. This
    // stays as the backstop for any other caller of this exported function.
    if (!addon.id) {
        apiLogger.error(
            { customerId, addonSlug: addon.slug },
            'HOS-847: recurring add-on checkout refused — the catalog row carries no id, so no MercadoPago plan can be resolved for it'
        );
        return {
            success: false,
            error: {
                code: 'RECURRING_ADDON_NOT_SELLABLE',
                message: `Add-on '${addon.slug}' cannot be purchased on a recurring basis`
            }
        };
    }

    let mpPreapprovalPlanId: string;
    try {
        mpPreapprovalPlanId = await resolveCheckoutMpAddonPlanId({
            addonId: addon.id,
            addonName: addon.name,
            // The LIST price, in centavos, and never `finalPrice`. The registry
            // key `(addon_id, billing_interval)` carries no discount dimension,
            // so a per-buyer amount would read as a price drift and re-provision
            // the plan on every checkout — archiving the one a concurrent buyer
            // is authorizing against. `createAddonCheckout` refuses a promo code
            // on this path for the same reason.
            amountCentavos: addon.priceArs,
            currency: 'ARS',
            billingInterval: RECURRING_ADDON_BILLING_INTERVAL,
            backUrl: input.successUrl
        });
    } catch (error) {
        // A genuine MercadoPago failure is re-thrown so `createAddonCheckout`'s
        // own catch maps it (502/503/504) and captures it to Sentry through
        // `captureBillingError`, exactly as the one-time path does. Swallowing
        // it into a typed result here is what kept these failures out of Sentry.
        if (isBillingProviderError(error)) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { customerId, addonSlug: addon.slug, error: message },
            'HOS-847: failed to resolve the MercadoPago preapproval_plan for a recurring add-on'
        );
        return {
            success: false,
            error: {
                code: 'ADDON_PROVIDER_ERROR',
                message: 'Could not prepare the recurring charge with the payment provider'
            }
        };
    }

    // Idempotency, before anything chargeable is created. See
    // `addon.checkout.recurring-idempotency.ts` for why a double click would
    // otherwise buy two preapprovals that both charge forever.
    const idempotency = await resolveRecurringAddonCheckoutIdempotency({
        billing,
        customerId,
        addonSlug: addon.slug,
        mpPreapprovalPlanId
    });

    if (idempotency.kind === 'reuse') {
        return {
            success: true,
            data: {
                checkoutUrl: idempotency.checkout.checkoutUrl,
                orderId,
                addonId: addon.slug,
                amount: addon.priceArs,
                currency: 'ARS',
                expiresAt: idempotency.checkout.expiresAt
            }
        };
    }

    if (idempotency.kind === 'blocked') {
        return {
            success: false,
            error: {
                code: 'ADDON_CHECKOUT_IN_FLIGHT',
                message:
                    'A previous add-on checkout is still being settled. Please try again in a few minutes.'
            }
        };
    }

    const planReference = await resolveSubscriptionPlanReference({
        billing,
        planIdOrSlug: planSubscription.planId
    });

    if (!planReference) {
        apiLogger.error(
            { customerId, addonSlug: addon.slug, planId: planSubscription.planId },
            'HOS-847: recurring add-on checkout refused — could not resolve the plan/price pair qzpay needs from the customer subscription'
        );
        return {
            success: false,
            error: {
                code: 'RECURRING_ADDON_PLAN_UNRESOLVED',
                message: 'Could not resolve the billing plan backing your subscription'
            }
        };
    }

    const payerEmail = await resolveAddonPayerEmail({
        customerId,
        customerEmail: input.customerEmail
    });

    if (!payerEmail) {
        return {
            success: false,
            error: {
                code: 'ADDON_PAYER_EMAIL_UNSUPPORTED',
                message:
                    "The email on your billing account contains a '+', which MercadoPago does not accept as a payer email. Please contact support to change it."
            }
        };
    }

    let subscriptionId: string;
    let mpSubscriptionId: string | undefined;
    let checkoutUrl: string;

    try {
        const created = await createOwnPreapprovalSubscription({
            billing,
            customerId,
            planId: planReference.planId,
            priceId: planReference.priceId,
            billingInterval: RECURRING_ADDON_BILLING_INTERVAL,
            paymentMethodReturnUrl: input.successUrl,
            notificationUrl: input.notificationUrl,
            // HOS-937 step 2: `payer_email` is BINDING on a preapproval — only
            // whoever uses that exact address can authorize the charge, and
            // MercadoPago never says which one it expected. The four plan
            // checkouts all resolve it; this path used to fall through to
            // `customer.email`, which is the wrong address for anyone whose
            // MercadoPago account lives under another one (HOS-208).
            payerEmail,
            // ZERO, stated. Omitted, qzpay-core inherits the BORROWED price's
            // `trialDays` — 30, on the owner monthly price, since data-migration
            // 0055 — and `@qazuor/qzpay-drizzle` would write a 30-day
            // `trial_start`/`trial_end` onto this row for a trial MercadoPago
            // was never asked for and never granted. See
            // {@link RECURRING_ADDON_LOCAL_TRIAL_DAYS}. This is the LOCAL trial
            // field; `freeTrialDays` (the one guard G-1 bans) does not exist on
            // this path at all.
            trialDays: RECURRING_ADDON_LOCAL_TRIAL_DAYS,
            // The add-on's OWN MercadoPago plan. This is what makes the
            // preapproval charge the add-on's amount on the add-on's cadence.
            providerPriceId: mpPreapprovalPlanId,
            // HOS-847 PR 2: without this the row defaults to
            // `'accommodation'`, which `subscriptionMatchesDomain` fails OPEN
            // on — the add-on's preapproval would then be counted as the
            // owner's accommodation subscription by the entitlement engine and
            // by every cron sweep.
            productDomain: ProductDomainEnum.ADDON,
            metadata: {
                type: 'addon_purchase',
                addonSlug: addon.slug,
                addonId: addon.id,
                orderId,
                userId,
                ...(input.accommodationId === undefined
                    ? {}
                    : { accommodationId: input.accommodationId })
            }
        });

        subscriptionId = created.subscription.id;
        mpSubscriptionId = created.subscription.providerSubscriptionIds?.mercadopago;
        checkoutUrl = created.checkoutUrl;
    } catch (error) {
        // Same rule as the plan-resolution catch above: a real provider failure
        // goes to Sentry through the caller's `captureBillingError`, not into a
        // log line nobody is paged for.
        if (isBillingProviderError(error)) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        apiLogger.error(
            { customerId, addonSlug: addon.slug, mpPreapprovalPlanId, error: message },
            'HOS-847: failed to create the MercadoPago preapproval for a recurring add-on'
        );
        return {
            success: false,
            error: {
                code:
                    error instanceof SubscriptionCheckoutError
                        ? 'ADDON_PROVIDER_ERROR'
                        : 'CHECKOUT_ERROR',
                message: 'Could not start the recurring charge with the payment provider'
            }
        };
    }

    // `createOwnPreapprovalSubscription` cannot return without one (its
    // `MISSING_PROVIDER_SUBSCRIPTION_ID` guard cancels and throws), but the
    // purchase row's whole job is to carry this id to the webhook, so an empty
    // one is not something to write and hope about.
    if (!mpSubscriptionId) {
        await cancelPreapprovalBestEffort({ billing, subscriptionId, customerId, addon });
        return {
            success: false,
            error: {
                code: 'ADDON_PROVIDER_ERROR',
                message: 'The payment provider returned no subscription id for this add-on'
            }
        };
    }

    let purchaseId: string;
    try {
        purchaseId = await insertPendingRecurringPurchase({
            customerId,
            planSubscriptionId: planSubscription.id,
            addon,
            mpSubscriptionId,
            orderId,
            userId,
            accommodationId: input.accommodationId
        });
    } catch (error) {
        apiLogger.error(
            {
                customerId,
                addonSlug: addon.slug,
                subscriptionId,
                mpSubscriptionId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: pending add-on purchase row could not be written — cancelling the preapproval so it cannot charge unseen'
        );
        await cancelPreapprovalBestEffort({ billing, subscriptionId, customerId, addon });
        return {
            success: false,
            error: {
                code: 'CHECKOUT_ERROR',
                message: 'Could not record the add-on purchase'
            }
        };
    }

    apiLogger.info(
        {
            customerId,
            userId,
            addonSlug: addon.slug,
            addonId: addon.id,
            purchaseId,
            planSubscriptionId: planSubscription.id,
            subscriptionId,
            mpSubscriptionId,
            mpPreapprovalPlanId,
            billingInterval: RECURRING_ADDON_BILLING_INTERVAL,
            amount: addon.priceArs,
            orderId
        },
        'HOS-847: created a recurring add-on preapproval; purchase is pending until the webhook confirms the charge'
    );

    return {
        success: true,
        data: {
            checkoutUrl,
            orderId,
            addonId: addon.slug,
            amount: addon.priceArs,
            currency: 'ARS',
            expiresAt: new Date(Date.now() + RECURRING_ADDON_CHECKOUT_TTL_MS).toISOString()
        }
    };
}

/**
 * Cancel a just-created add-on preapproval without letting the cancellation's
 * own failure mask the original one.
 *
 * Compensating action only — the caller is already on an error path and returns
 * its own error regardless. A failure here is logged loudly because it leaves
 * exactly the state HOS-751 was filed for: a preapproval MercadoPago will keep
 * charging, with nothing local pointing at it.
 */
async function cancelPreapprovalBestEffort(input: {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly customerId: string;
    readonly addon: AddonDefinition;
}): Promise<void> {
    try {
        await input.billing.subscriptions.cancel(input.subscriptionId);
    } catch (cancelError) {
        apiLogger.error(
            {
                customerId: input.customerId,
                addonSlug: input.addon.slug,
                subscriptionId: input.subscriptionId,
                error: cancelError instanceof Error ? cancelError.message : String(cancelError)
            },
            'HOS-847: FAILED to cancel the add-on preapproval after a failed checkout — a live preapproval may now exist with no local purchase row (HOS-751 class), needs manual reconciliation'
        );
    }
}
