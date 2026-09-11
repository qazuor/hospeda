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
 * of its own.
 *
 * It also has its own `preapproval_plan`, which PR 3's
 * {@link resolveCheckoutMpAddonPlanId} provisions and caches — but since the
 * HOS-1221 port that plan is **no longer what charges**. It is never sent to
 * MercadoPago (doing so is the 400 that kept this whole branch at 500); it
 * survives as the priced-variant key the idempotency check compares to detect a
 * catalog price drift between two attempts. What charges is the inline
 * `auto_recurring` the adapter builds, seeded with `providerUnitAmountOverride`
 * at the add-on's own price — see the create call below.
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
    resolveAddonPayerEmail,
    resolveSubscriptionPlanReference
} from './addon.checkout.recurring-resolve.js';
import {
    cancelPreapprovalBestEffort,
    insertPendingRecurringPurchase
} from './addon.checkout.recurring-write.js';
import { type AddonCheckoutLocale, resolveAddonCheckoutName } from './addon-checkout-locale.js';
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
    /**
     * Buyer's locale, forwarded from `PurchaseAddonInput.locale`.
     *
     * The preapproval's `reason` is the ONE string the buyer reads before
     * authorizing a recurring debit, and `AddonDefinition.name` is an English
     * config literal by convention (`packages/billing/CLAUDE.md`) — the web app
     * never renders it, it resolves `account.addons.catalog.<slug>.name`
     * instead. Sending the raw literal is the HOS-606 defect, re-entering
     * through a different field: a buyer who clicked "Pack de fotos extra"
     * would be asked to authorize "Extra Photos Pack (+20 photos)".
     *
     * Optional, and `undefined` falls back to `'es'` inside
     * `resolveAddonCheckoutName` — the same default the `successUrl` /
     * `cancelUrl` prefixes take.
     */
    readonly locale?: AddonCheckoutLocale | undefined;
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
            // The RAW config name, deliberately NOT the buyer's localized one
            // (unlike `planDisplayName` below, which is the string the buyer
            // actually reads). This feeds the `preapproval_plan`'s own reason,
            // and that plan is a SHARED, seller-side registry row: one per
            // `(addon_id, billing_interval)` for every buyer in every language.
            // A localized label there would freeze whichever locale happened to
            // provision it first. Nothing compares it — the registry key is
            // `(addon_id, billing_interval)` and drift is decided on
            // `amountArs` + `status` alone — so this is a labelling choice, not
            // a constraint, and no buyer sees it: since the plan id stopped
            // being sent, MercadoPago renders the preapproval's own reason.
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
            // HOS-1221 ported to the add-on path. What used to sit here was
            // `providerPriceId: mpPreapprovalPlanId` — the add-on's own
            // MercadoPago plan, handed to the provider. That builds MercadoPago's
            // "subscription WITH an associated plan" request, which it rejects
            // with HTTP 400 "Create subscription - card_token_id is required"
            // because a self-serve checkout never tokenizes a card. Every one of
            // these checkouts answered 500 with the flag on, exactly as the four
            // plan checkouts did before HOS-1221.
            //
            // Deleting that line alone would have been the WRONG fix. Without a
            // plan id the adapter builds the inline `auto_recurring` from the
            // resolved price — and the resolved price here is BORROWED from the
            // owner's plan (see {@link resolveSubscriptionPlanReference}), so the
            // buyer of a ARS 5.000/month add-on would have been charged the
            // owner plan's ARS 18.000-and-up monthly amount, forever. The amount
            // has to be stated instead.
            //
            // `addon.priceArs` is the catalog LIST price in centavos — the same
            // unit as `billing_prices.unit_amount`, which is what qzpay hands the
            // adapter — and deliberately the list price, never `finalPrice`: this
            // path refuses promo codes (`createAddonCheckout`) for the same
            // reason `resolveCheckoutMpAddonPlanId` above takes the list price.
            providerUnitAmountOverride: addon.priceArs,
            // What the buyer READS on MercadoPago's authorization page. Without
            // it the adapter builds the reason from the BORROWED plan's `name`,
            // so someone buying "Extra Photos Pack" would have been asked to
            // authorize "owner-premium - Mensual" — a different product at a
            // different price. Only reachable now that the plan id is gone:
            // `planDisplayName` has no effect on the plan-based flow, where
            // MercadoPago renders the plan's own reason instead.
            //
            // Resolved through the SAME i18n lookup the one-time path uses for
            // its line-item title (HOS-606), not `addon.name`: that field is an
            // English config literal the product never renders, so the buyer who
            // clicked "Pack de fotos extra (+20 fotos)" was being asked to
            // authorize a recurring debit for "Extra Photos Pack (+20 photos)".
            // Naming the same product in the same language is the whole point of
            // overriding this field. The 60-character MercadoPago budget every
            // locale's translation stays inside is pinned by
            // `test/services/addon-checkout-locale.test.ts`.
            planDisplayName: resolveAddonCheckoutName({
                locale: input.locale,
                slug: addon.slug,
                fallback: addon.name
            }),
            // BOOKKEEPING ONLY — recorded on the row's metadata, never sent to
            // MercadoPago. The add-on's MP plan is still provisioned and still
            // identifies the priced variant: `decideRecurringAddonReuse`
            // (`addon.checkout.recurring-idempotency.ts`) compares it against the
            // current attempt's to refuse a checkout whose price has since
            // drifted. It used to reach that stamp by riding on
            // `providerPriceId`; HOS-1221 split the two apart precisely so
            // recording a plan no longer means sending one.
            mpPreapprovalPlanId,
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
