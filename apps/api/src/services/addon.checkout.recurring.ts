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
import { apiLogger } from '../utils/logger.js';
import type { AddonBillingIntervalLabel } from './billing/mp-addon-plan-provisioning.service.js';
import { resolveCheckoutMpAddonPlanId } from './billing/mp-addon-plan-provisioning.service.js';
import { createOwnPreapprovalSubscription } from './billing/own-preapproval-subscription-create.js';
import { SubscriptionCheckoutError } from './billing/subscription-checkout-error.js';

/**
 * Cadence every recurring add-on preapproval is created on.
 *
 * A module constant, not an input, because nothing upstream can express the
 * other value: `PurchaseAddonInput` carries no interval, no route accepts one,
 * and no surface offers the annual price the catalog declares
 * (`AddonDefinition.annualPriceArs`). Making the annual cadence buyable is a
 * product change — a price to show, a control to pick it, and the cancellation
 * arithmetic that goes with a twelve-month commitment — not something this
 * checkout may infer. Until that exists, one cadence is the honest answer;
 * {@link AddonBillingIntervalLabel} already carries the other for the day it
 * lands.
 */
const RECURRING_ADDON_BILLING_INTERVAL: AddonBillingIntervalLabel = 'monthly';

/**
 * Status a recurring add-on purchase row is born in.
 *
 * `'pending'` is one of the four values the `billing_addon_purchases` CHECK
 * constraint already allows, so this needs no migration. It means exactly
 * "preapproval created, not yet authorized"; the webhook (PR 5) is what moves
 * it to `'active'` and applies the benefit.
 */
export const RECURRING_ADDON_PENDING_STATUS = 'pending' as const;

/**
 * How long the returned checkout window is advertised for.
 *
 * Mirrors `PENDING_PROVIDER_TTL_MS` in `subscription-checkout.service.ts`,
 * re-declared locally for the reason `abandoned-pending-subs.job.ts` re-declares
 * it too: importing that module pulls the whole subscription-checkout surface in
 * for one integer. There is no correlation row with a real TTL in the
 * own-preapproval flow, so this is a synthesized window, exactly as the
 * accommodation own-preapproval branch synthesizes its own.
 */
const RECURRING_ADDON_CHECKOUT_TTL_MS = 30 * 60 * 1000;

/**
 * Decide whether a checkout should take the recurring (preapproval) path.
 *
 * Both halves matter and neither is redundant: the flag is what keeps the
 * branch dark in production, and `billingType` is what keeps the two one-time
 * add-ons (`visibility-boost-7d` / `-30d`, which are genuinely single charges
 * with a `durationDays` window) on the `Preference` path even once the flag is
 * flipped.
 *
 * @param input.recurringAddonsEnabled - The resolved
 *   `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` boolean (already coerced from
 *   the literal `'true'` by the env schema).
 * @param input.billingType - The add-on's catalog billing type.
 * @returns `true` when the recurring preapproval path applies.
 */
export function shouldUseRecurringAddonCheckout(input: {
    readonly recurringAddonsEnabled: boolean;
    readonly billingType: AddonDefinition['billingType'];
}): boolean {
    return input.recurringAddonsEnabled === true && input.billingType === 'recurring';
}

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
    /** Buyer's user id, carried for tracing and for the webhook's context. */
    readonly userId: string;
    /**
     * The customer's REAL plan subscription — the one the domain gate in
     * `createAddonCheckout` already resolved for this add-on's product domain,
     * never another add-on's preapproval row.
     *
     * Its `planId` is borrowed as the local `plan_id` of the add-on's own
     * subscription row. See {@link resolveSubscriptionPlanReference} for why
     * that borrowing is safe and why there is no alternative.
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
 * Resolve the `(planId, priceId)` pair qzpay-core requires to create a
 * `mode: 'paid'` subscription, from the customer's existing plan subscription.
 *
 * ## Why the add-on borrows the customer's plan
 *
 * `billing.subscriptions.create({ mode: 'paid' })` looks the plan up (config
 * map first, then `billing_plans`) and throws `QZPayValidationError` when
 * neither the plan nor a price resolves. An add-on has no `billing_plans` row
 * and must not get one: those rows are the public plan catalog
 * (`GET /api/v1/public/plans`, `ALL_PLANS`, the grant-matrix snapshots), and a
 * synthetic add-on plan would surface in all three.
 *
 * Borrowing is safe because the plan contributes NOTHING to what is charged.
 * With `providerPriceId` set — which this flow always sets, to the add-on's own
 * `preapproval_plan` — the MercadoPago adapter emits
 * `{ payer_email, external_reference, reason, back_url, notification_url,
 * preapproval_plan_id }` and returns early, never reading the price's amount,
 * currency or interval. The amount comes from the add-on's MP plan and only
 * from there.
 *
 * The one thing the borrowed plan DOES reach is the preapproval's `reason`,
 * which the adapter builds as `` `${plan.name} - Mensual` ``. For a plan-based
 * preapproval MercadoPago is expected to display the plan's own reason (the
 * add-on's, built by `buildAddonPlanReason`), but that is expectation, not
 * measurement — it is on the PR 8 staging smoke to confirm what the buyer
 * actually reads.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.planIdOrSlug - `billing_subscriptions.plan_id`, which is a UUID
 *   on modern rows and a legacy slug on older ones (SPEC-168), so both are
 *   tried — matching `resolvePlanByIdOrSlug`'s dual-resolve in
 *   `addon.checkout.ts`.
 * @returns The ids to hand qzpay, or `null` when the plan or its prices cannot
 *   be resolved.
 */
async function resolveSubscriptionPlanReference(input: {
    readonly billing: QZPayBilling;
    readonly planIdOrSlug: string;
}): Promise<{ readonly planId: string; readonly priceId: string } | null> {
    const plans = await input.billing.plans.listAll();
    const plan =
        plans.find((candidate) => candidate.id === input.planIdOrSlug) ??
        plans.find((candidate) => candidate.name === input.planIdOrSlug);

    if (!plan) {
        return null;
    }

    const prices = plan.prices ?? [];
    // Prefer the plain monthly price for the same reason `findMonthlyPrice`
    // exists in the subscription checkout: the multi-month variants share the
    // `'month'` interval with a different `intervalCount` and belong to
    // plan-change flows. Falls back to any active price and then to the first
    // one, because qzpay itself falls back to `prices[0]` when the id misses —
    // and the price is never read once `providerPriceId` is set anyway.
    const price =
        prices.find((p) => p.active && p.billingInterval === 'month' && p.intervalCount === 1) ??
        prices.find((p) => p.active) ??
        prices[0];

    if (!price) {
        return null;
    }

    return { planId: plan.id, priceId: price.id };
}

/**
 * Insert the `billing_addon_purchases` row backing a recurring add-on, in
 * `'pending'`.
 *
 * Deliberately a plain INSERT with no entitlement work and no `'active'`
 * status: the partial unique index `idx_addon_purchases_active_unique` only
 * covers `status = 'active'`, so a pending row collides with nothing, and
 * nothing downstream reads a pending row as a granted benefit.
 *
 * @returns The new row's id.
 */
async function insertPendingRecurringPurchase(input: {
    readonly customerId: string;
    readonly subscriptionId: string;
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
            subscriptionId: input.subscriptionId,
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
 *  2. Resolve the `(planId, priceId)` qzpay needs, from the customer's plan.
 *  3. Create the preapproval via {@link createOwnPreapprovalSubscription},
 *     stamping `product_domain = 'addon'` so every sweep that assumes one
 *     subscription row per customer skips it, plus `metadata.addonSlug` so the
 *     webhook can tell what was bought.
 *  4. Insert the `'pending'` purchase row carrying `mp_subscription_id`.
 *
 * Step 4 is fail-closed: if the local insert fails, the preapproval created in
 * step 3 is cancelled best-effort before the error is returned. A live
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
    if (!addon.id) {
        apiLogger.error(
            { customerId, addonSlug: addon.slug },
            'HOS-847: recurring add-on checkout refused — the catalog row carries no id, so no MercadoPago plan can be resolved for it'
        );
        return {
            success: false,
            error: {
                code: 'CHECKOUT_ERROR',
                message: `Add-on '${addon.slug}' cannot be purchased on a recurring basis`
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
                code: 'CHECKOUT_ERROR',
                message: 'Could not resolve the billing plan backing your subscription'
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
            // The add-on's OWN MercadoPago plan. This is what makes the
            // preapproval charge the add-on's amount on the add-on's cadence,
            // and what makes the borrowed `planReference` above inert.
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
            subscriptionId,
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
