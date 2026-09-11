/**
 * Add-on Checkout Module
 *
 * Handles creation of qzpay-managed checkout sessions for add-on purchases
 * and confirmation of purchases after payment webhook callbacks.
 *
 * @module services/addon.checkout
 */

import { randomUUID } from 'node:crypto';
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { isEntitlementGrantingStatus } from '@repo/billing';
import type { DrizzleClient } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type {
    ConfirmPurchaseInput,
    PurchaseAddonInput,
    PurchaseAddonResult,
    ServiceResult
} from '@repo/service-core';
import {
    AddonCatalogService,
    hydrateSubscriptionProductDomains,
    isAddonSubscription,
    resolveFeaturableEntityType,
    subscriptionMatchesDomain
} from '@repo/service-core';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../lib/billing-provider-error';
import { captureBillingError } from '../lib/sentry';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
import { createRecurringAddonCheckout } from './addon.checkout.recurring';
import { shouldUseRecurringAddonCheckout } from './addon.checkout.recurring-resolve';
import { resolveAddonCheckoutDescription, resolveAddonCheckoutName } from './addon-checkout-locale';
import type { AddonEntitlementService } from './addon-entitlement.service';
// HOS-847 PR 5: both the ledger write and the plan/adjustment computation moved
// out so the recurring ACTIVATION path reuses them verbatim. A recurring
// purchase activated with an empty `limit_adjustments` array contributes zero
// to `addon-plan-change.service.ts`'s combined-limit sum, which is why the
// computation had to become shared rather than be re-derived over there.
import { recordAddonPayment } from './addon-payment-ledger';
import {
    computeAddonPurchaseAdjustments,
    resolvePlanByIdOrSlug
} from './addon-purchase-adjustments';
import { resolveAddonTargetId, resolveAddonTargetListing } from './addon-target-listing';
import { resolveRecipientLocale } from './notification-recipient-locale';
import { PromoCodeService } from './promo-code.service';

// ─── Polling fallback (SPEC-127 T-010) ────────────────────────────────────────

/**
 * Input for the addon checkout polling job enqueue.
 *
 * Kept local because the subscription-checkout.service.ts helper requires
 * `planSlug` (subscription-specific) and `sourceLabel` in a shape that
 * does not cleanly fit addon purchases. We call the storage layer directly
 * here, matching the pattern used by `initiatePaidAnnualSubscription`.
 */
interface ScheduleAddonPollingInput {
    readonly billing: QZPayBilling;
    readonly subscriptionId: string;
    readonly checkoutSessionId: string;
    readonly customerId: string;
    readonly addonSlug: string;
    readonly orderId: string;
    readonly userId: string;
    /**
     * Target accommodation for a `requiresAccommodationTarget` add-on
     * (SPEC-309 OQ-3), validated by `createAddonCheckout` before the session
     * was created. `undefined` for every owner-wide add-on.
     */
    readonly accommodationId?: string | undefined;
    /**
     * Promo code redeemed at checkout (HOS-721). `undefined` when the purchase
     * carries no discount. Travels for the same reason `accommodationId` does:
     * the polling job row — not the MP payment — is the reliable carrier.
     */
    readonly promoCodeId?: string | undefined;
    /** Human-facing promo code as typed by the customer (HOS-721). */
    readonly promoCode?: string | undefined;
    /** Discount applied at checkout in centavos (HOS-721). */
    readonly discountAmount?: number | undefined;
}

/**
 * Enqueue a polling fallback for an addon checkout session.
 *
 * MP Preferences only deliver legacy IPN webhooks that the marker filter
 * drops (SPEC-143 Finding #21), so one-time addon payments need a polling
 * fallback — the same reason `initiatePaidAnnualSubscription` schedules one.
 *
 * Read "fallback" as a name, not a description: for a Preference there is no
 * Webhooks v2 channel at all, so this job is the ONLY way an approved payment
 * ever gets confirmed. If it is not enqueued, the money is collected and
 * nothing is recorded — that was HOS-710. Adding `?source_news=webhooks` to
 * the preference's notification_url does NOT provide a second path: it only
 * lets IPN deliveries past the filter and into a v2 signature verifier that
 * rejects them.
 *
 * Non-fatal: a failure here is logged as a warning and does not block the
 * checkout response (SPEC-127 FR-5). The checkout session was already
 * created successfully; the webhook remains the primary activation path,
 * and this polling job is the secondary path.
 *
 * Skipped silently when:
 * - `HOSPEDA_BILLING_POLLING_ENABLED` is off (test/legacy environments).
 * - The storage adapter does not expose `subscriptionPollingJobs`.
 * - The checkout session id is empty (defensive guard).
 */
async function scheduleAddonCheckoutPolling(input: ScheduleAddonPollingInput): Promise<void> {
    const {
        billing,
        subscriptionId,
        checkoutSessionId,
        customerId,
        addonSlug,
        orderId,
        userId,
        accommodationId,
        promoCodeId,
        promoCode,
        discountAmount
    } = input;

    if (!env.HOSPEDA_BILLING_POLLING_ENABLED) {
        return;
    }

    if (!checkoutSessionId) {
        apiLogger.warn(
            { subscriptionId, customerId, addonSlug },
            'Skipping addon polling enqueue — checkout session id is empty'
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
            providerResourceId: checkoutSessionId,
            resourceType: 'one_time_payment',
            provider: 'mercadopago',
            metadata: {
                type: 'addon_purchase',
                addonSlug,
                customerId,
                userId,
                orderId,
                // HOS-675: the job metadata is the RELIABLE carrier of the target
                // accommodation, not the MP payment metadata. MercadoPago
                // normalizes preference metadata keys, so the polling job's
                // synthetic payload already sources `addonSlug`/`customerId`
                // from here rather than from the payment; the accommodation key
                // has to travel the same way or it never reaches
                // `confirmAddonPurchase`. This matters more than it looks: for a
                // Preference there is no Webhooks v2 channel at all (see the
                // HOS-710 note above), so polling is usually the ONLY path that
                // ever confirms the purchase — the staging repro of HOS-675 was
                // confirmed with `source: 'polling'`.
                ...(accommodationId === undefined ? {} : { accommodationId }),
                // HOS-721: the promo keys ride the same carrier, for the same
                // reason. They are written in canonical camelCase here because
                // this row is ours — MercadoPago never touches it, so the
                // snake_case wire spelling has no business in it.
                ...(promoCodeId === undefined ? {} : { promoCodeId }),
                ...(promoCode === undefined ? {} : { promoCode }),
                ...(discountAmount === undefined ? {} : { discountAmount })
            }
        });
        if (job) {
            apiLogger.debug(
                {
                    jobId: job.id,
                    subscriptionId,
                    checkoutSessionId,
                    addonSlug,
                    nextPollAt: job.nextPollAt.toISOString()
                },
                'Scheduled addon checkout polling fallback'
            );
        } else {
            // HOS-710: this used to fire on every add-on purchase after the
            // first, because the uniqueness was scoped to `subscription_id` and
            // one abandoned checkout held the only slot for an hour. It is now
            // scoped to `(provider, provider_resource_id)`, and the session id
            // is freshly generated per checkout, so reaching this branch means
            // a genuine duplicate enqueue for the SAME session — a double
            // submit, not a second purchase. Logged as a warning because it
            // should now be rare rather than routine.
            apiLogger.warn(
                { subscriptionId, checkoutSessionId, addonSlug },
                'Active polling job already exists for this checkout session — skipping duplicate addon enqueue'
            );
        }
    } catch (error) {
        // Non-fatal per SPEC-127 FR-5: the checkout succeeded; failing to schedule
        // polling means we rely entirely on the webhook for activation.
        apiLogger.warn(
            {
                customerId,
                addonSlug,
                checkoutSessionId,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to enqueue addon checkout polling job — webhook is the only activation path now'
        );
    }
}

// ─── Addon catalog service (DB-backed addon reads — SPEC-127 T-003) ───────────
// Replaces `getAddonBySlug` from `@repo/billing` (config catalog).
// Instantiated once at module level; stateless, no DB connection held.
const addonCatalogService = new AddonCatalogService();

/**
 * Create a qzpay-managed checkout session for an add-on purchase.
 *
 * Validates that:
 * - The add-on exists and is active
 * - The customer exists
 * - The customer has an active or trialing subscription
 * - The promo code (if provided) is valid
 *
 * Then creates a checkout session via `billing.checkout.create()` with a
 * 30-minute expiration window and records promo code usage if applicable.
 *
 * @param billing - QZPay billing instance
 * @param input - Purchase request details
 * @returns Checkout URL, order ID, amount, and expiration
 *
 * @throws {ServiceError} With `ServiceErrorCode.PROVIDER_ERROR` (→ HTTP 502),
 *   `ServiceErrorCode.PROVIDER_RATE_LIMITED` (→ HTTP 503), or
 *   `ServiceErrorCode.PROVIDER_TIMEOUT` (→ HTTP 504) when MercadoPago returns
 *   a provider-level error that was wrapped by qzpay-core as
 *   `QZPayProviderSyncError`. These are mapped by `handleRouteError` via the
 *   `isBillingProviderError` / `mapProviderErrorToServiceError` helpers.
 *   All other failures return `ServiceResult` with `success: false` and never throw.
 *
 * @example
 * ```ts
 * const result = await createAddonCheckout(billing, {
 *   customerId: 'cust_123',
 *   addonSlug: 'extra-photos',
 *   userId: 'user_456',
 *   promoCode: 'SAVE10',
 * });
 * if (result.success) {
 *   redirect(result.data.checkoutUrl);
 * }
 * ```
 */
export async function createAddonCheckout(
    billing: QZPayBilling,
    input: PurchaseAddonInput
): Promise<ServiceResult<PurchaseAddonResult>> {
    try {
        const addonResult = await addonCatalogService.getBySlug(input.addonSlug);

        if (!addonResult.success) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

        const addon = addonResult.data;

        // SPEC-309 OQ-3, generalised by HOS-1286: target-required addons (the six
        // `visibility-boost-*` entries) apply their effect to a single LISTING,
        // not owner-wide. Capture and validate the target before creating the
        // checkout session so an invalid target never reaches MercadoPago.
        //
        // Which TABLE the id is looked up in comes from the addon's own
        // `productDomain`, never from the request — see `addon-target-listing.ts`.
        if (addon.requiresAccommodationTarget) {
            const targetResult = await resolveAddonTargetListing({
                addon: { slug: addon.slug, productDomain: addon.productDomain },
                entityId: resolveAddonTargetId(input),
                userId: input.userId
            });

            if (!targetResult.ok) {
                return { success: false, error: targetResult.error };
            }
        }

        if (!addon.isActive) {
            return {
                success: false,
                error: {
                    code: 'ADDON_INACTIVE',
                    message: 'This add-on is not currently available for purchase'
                }
            };
        }

        const customer = await billing.customers.get(input.customerId);

        if (!customer) {
            return {
                success: false,
                error: { code: 'CUSTOMER_NOT_FOUND', message: 'Billing customer not found' }
            };
        }

        const rawSubscriptions = await billing.subscriptions.getByCustomerId(input.customerId);

        if (!rawSubscriptions || rawSubscriptions.length === 0) {
            return {
                success: false,
                error: {
                    code: 'NO_SUBSCRIPTION',
                    message: 'You must have an active subscription to purchase add-ons'
                }
            };
        }

        // HOS-1178 — `getByCustomerId()` builds its objects field-by-field from
        // qzpay-core's own interface, so `productDomain` arrives `undefined` on
        // EVERY subscription regardless of its real vertical (see
        // `hydrateSubscriptionProductDomains`'s doc). Handed straight to
        // `subscriptionMatchesDomain`, that `undefined` reads as "legacy row,
        // fail open to accommodation" for all of them — the domain check below
        // would pass everything and refuse every commerce purchase, which is
        // both halves of wrong at once.
        //
        // Wrapped, and degrading to the UN-hydrated list, for the reason
        // `commerceVerticalEntitlementMiddleware` wraps its own copy: this
        // route is shared with accommodation, and accommodation is the only
        // side with live subscribers. Letting a database blip escape here would
        // turn a host's add-on purchase into a 500 — a failure mode introduced
        // by a check that exists for commerce and does nothing for them.
        //
        // The degradation is safe in the one direction that matters. An
        // un-hydrated subscription carries `productDomain: undefined`, which
        // `subscriptionMatchesDomain` reads as accommodation:
        //   - a host buying an accommodation add-on still succeeds;
        //   - a commerce purchase is REFUSED, because `undefined` matches
        //     neither gastronomy nor experience.
        // So a blip can only refuse a purchase that should have gone through.
        // It can never let a cross-domain one past, which is the whole point of
        // the gate and the thing that must not degrade.
        // Typed off the raw list so every downstream read (`status`, `planId`)
        // keeps its type; hydration only ADDS `productDomain`, and the optional
        // marker is what lets the un-hydrated list stand in on the catch path.
        let subscriptions: readonly ((typeof rawSubscriptions)[number] & {
            productDomain?: string | null;
        })[] = rawSubscriptions;
        try {
            subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);
        } catch (error) {
            apiLogger.warn(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Failed to hydrate subscription product domains; falling back to the un-hydrated list (HOS-1178)'
            );
        }

        // HOS-847: never let a recurring add-on's own preapproval row stand in
        // as "the" customer subscription here — see `isAddonSubscription`'s
        // doc. Filtered alongside the status check (rather than left to the
        // domain gate below alone) so a customer whose ONLY granting
        // subscription is an add-on's own preapproval is correctly refused
        // with NO_ACTIVE_SUBSCRIPTION instead of a domain-specific error.
        const grantingSubscriptions = subscriptions.filter(
            (sub: { status: string }) =>
                isEntitlementGrantingStatus(sub.status) && !isAddonSubscription(sub)
        );

        if (grantingSubscriptions.length === 0) {
            return {
                success: false,
                error: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    message: 'You must have an active subscription to purchase add-ons'
                }
            };
        }

        // ── Product-domain gate (HOS-1178) ───────────────────────────────────
        //
        // Until this existed, the route validated `isActive` and
        // `targetCategories` and nothing else — and `targetCategories` cannot
        // separate verticals, because all SIX commerce plans declare
        // `category: 'owner'`, the same value the accommodation plans carry. So
        // a gastronomy owner could buy `extra-experiences-1`, which is the leak
        // HOS-974 D-C and HOS-1060's `productDomain` field were meant to close:
        // the field was declared on all eight add-ons and nothing on the paying
        // path read it.
        //
        // Two things this must NOT do, both of them ways to break hosts, who —
        // unlike commerce — have live subscriptions in production:
        //
        //  1. It resolves the subscription of the ADD-ON's domain, not "the"
        //     subscription. An owner can hold an accommodation AND a commerce
        //     subscription at once (`host-provider@local.test` is seeded to
        //     prove it), and the previous `.find()` took whichever came first.
        //     That also fixes the `targetCategories` check below, which was
        //     reading whichever plan that arbitrary pick happened to name.
        //  2. It goes through `subscriptionMatchesDomain`, the only place in the
        //     repo that compares a subscription's domain, and reads asymmetric
        //     ON PURPOSE: `accommodation` fails OPEN (the column post-dates
        //     almost every row, so a legacy host row still counts as
        //     accommodation), every other domain fails closed. A hand-written
        //     `sub.productDomain === domain` here would refuse every host whose
        //     row predates the column.
        const addonProductDomain = addon.productDomain;

        if (!addonProductDomain) {
            // The catalogue does not know this slug — an add-on an operator
            // created through the SPEC-168 admin UI. It has no declared
            // vertical, and guessing `'accommodation'` is the `?? ACCOMMODATION`
            // HOS-1078 deleted one layer down. Fail CLOSED, with its own code so
            // the operator can see the cause rather than a generic refusal.
            return {
                success: false,
                error: {
                    code: 'ADDON_DOMAIN_UNKNOWN',
                    message: `Add-on '${addon.slug}' does not declare a product domain and cannot be purchased`
                }
            };
        }

        const activeSubscription = grantingSubscriptions.find((sub) =>
            subscriptionMatchesDomain(sub, addonProductDomain)
        );

        if (!activeSubscription) {
            return {
                success: false,
                error: {
                    code: 'ADDON_NOT_AVAILABLE_FOR_DOMAIN',
                    message: `This add-on requires an active ${addonProductDomain} subscription`
                }
            };
        }

        // Validate addon is available for the customer's plan category.
        // Post-SPEC-168, planId may be a UUID or a legacy slug — use dual-resolve
        // via PlanService (DB-backed) rather than the static ALL_PLANS config.
        if (addon.targetCategories && addon.targetCategories.length > 0) {
            const customerPlan = await resolvePlanByIdOrSlug(activeSubscription.planId);
            if (customerPlan && !addon.targetCategories.includes(customerPlan.category)) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_NOT_AVAILABLE_FOR_PLAN',
                        message: `This add-on is not available for ${customerPlan.category} plans`
                    }
                };
            }
        }

        // ── HOS-847 PR 4: recurring add-on checkout, behind a dark flag ──────
        //
        // Decided here — after every validation the two paths share, before any
        // path-specific work — so the flag can only ever change WHICH checkout
        // is created, never whether the purchase was allowed in the first place.
        // Off (the production default, and the only value any environment has
        // today) this is `false` and everything below is the one-time
        // `Preference` path byte for byte.
        // Asynchronous because the third condition is a POSITIVE read of the
        // catalog row's real `billing_interval` — `billingType` is derived by
        // exclusion in `addon-catalog.mapper.ts`, so a NULL, an empty string or
        // an operator's typo all present as `'recurring'`. With the flag off the
        // function returns on its first line and issues no query.
        const useRecurringCheckout = await shouldUseRecurringAddonCheckout({
            recurringAddonsEnabled: env.HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED === true,
            addon
        });

        // A promo code cannot be honoured on the recurring path, and refusing is
        // the only honest answer available.
        //
        // The discount would have to live somewhere, and both places are closed:
        // the add-on's MercadoPago `preapproval_plan` is keyed
        // `(addon_id, billing_interval)` with NO discount dimension, so a
        // per-buyer amount makes every checkout look like a price drift and
        // re-provisions the plan (archiving the one a concurrent buyer is
        // authorizing against — see `ResolveOrProvisionMpAddonPlanInput
        // .amountCentavos`); and mutating the preapproval's own
        // `transaction_amount` afterwards is the multi-cycle-discount machinery
        // SPEC-262 built for plans, which is new scope and an owner decision.
        //
        // The alternative — accepting the code and silently charging the full
        // price anyway — is not a smaller version of that work. It is a customer
        // authorizing a recurring charge for an amount they were never shown.
        if (useRecurringCheckout && input.promoCode) {
            return {
                success: false,
                error: {
                    code: 'RECURRING_ADDON_PROMO_UNSUPPORTED',
                    message: 'Promo codes cannot be applied to a recurring add-on subscription'
                }
            };
        }

        // Validate and apply promo code if provided
        let finalPrice = addon.priceArs;
        let promoCodeId: string | undefined;
        let discountAmount = 0;

        if (input.promoCode) {
            const promoService = new PromoCodeService();
            const validation = await promoService.validate(input.promoCode, {
                userId: input.userId,
                amount: addon.priceArs
            });

            if (!validation.valid) {
                return {
                    success: false,
                    error: {
                        code: 'INVALID_PROMO_CODE',
                        message: validation.errorMessage || 'Invalid promo code'
                    }
                };
            }

            if (validation.discountAmount) {
                discountAmount = validation.discountAmount;
                finalPrice = Math.max(0, addon.priceArs - discountAmount);
            }

            const promoCodeResult = await promoService.getByCode(input.promoCode);
            if (promoCodeResult.success && promoCodeResult.data) {
                promoCodeId = promoCodeResult.data.id;
            }
        }

        // SPEC-109 fix #5/#6: use a UUID as the idempotency key sent to the
        // provider. The `addon_<slug>_` prefix on orderId is kept for human
        // traceability in the provider dashboard. There is NO access-token
        // guard here: qzpay owns MP credentials (configured at billing adapter
        // init) and throws internally when the adapter is misconfigured —
        // matching the pattern used in the annual subscription flow in
        // subscription-checkout.service.ts.
        //
        // HOS-1272 CORRECTION: the line below this comment used to be preceded
        // by the claim "a retry from the same logical checkout reuses the same
        // UUID" — that is FALSE. `randomUUID()` is called fresh on every
        // invocation of this function, with no lookup of any prior attempt, so
        // two clicks (or the client's own retry) produce two DIFFERENT UUIDs,
        // two DIFFERENT `idempotencyKey`s, and two independently payable
        // MercadoPago Preferences for the same one-time add-on purchase. This
        // is the SAME class of bug HOS-1272 fixed for accommodation checkout,
        // just on the one-time (non-recurring) add-on path — NOT fixed here.
        // The recurring add-on path (`createRecurringAddonCheckout`, a few
        // lines below) IS protected, via
        // `resolveRecurringAddonCheckoutIdempotency`
        // (`addon.checkout.recurring-idempotency.ts`), which reads an existing
        // `billing_addon_purchases` row before minting. This one-time path has
        // no equivalent local row to check before the Preference is created —
        // closing this gap needs a new persisted pre-checkout intent (or a
        // query against the polling-job storage `billing.getStorage()
        // .subscriptionPollingJobs` already writes to, if it can be queried by
        // customer+addon), which is a real design decision and out of scope
        // for this comment fix. Tracked as a follow-up rather than built here.
        const checkoutUuid = randomUUID();
        const orderId = `addon_${addon.slug}_${checkoutUuid}`;
        const webUrl = env.HOSPEDA_SITE_URL;
        if (!webUrl) {
            return {
                success: false,
                error: {
                    code: 'PAYMENT_NOT_CONFIGURED',
                    message: 'HOSPEDA_SITE_URL is not configured'
                }
            };
        }
        const apiUrl = env.HOSPEDA_API_URL;
        if (!apiUrl) {
            return {
                success: false,
                error: {
                    code: 'PAYMENT_NOT_CONFIGURED',
                    message: 'HOSPEDA_API_URL is not configured'
                }
            };
        }

        // customerName is passed as a plain string so the qzpay adapter can
        // derive payer.first_name / payer.last_name via its built-in split logic.
        const customerName =
            typeof customer.metadata?.name === 'string'
                ? customer.metadata.name.trim() || undefined
                : undefined;

        // HOS-224 fallbacks, hoisted out of the `checkout.create` call below so
        // the recurring branch resolves the SAME return URL rather than a second
        // copy that could drift. Values are unchanged.
        const successUrl =
            input.successUrl ?? `${webUrl}/es/mi-cuenta/addons/?status=success&addon=${addon.slug}`;
        const cancelUrl =
            input.cancelUrl ?? `${webUrl}/es/mi-cuenta/addons/?status=failure&addon=${addon.slug}`;
        const notificationUrl = `${apiUrl}/api/v1/webhooks/mercadopago`;

        // HOS-847 PR 4: the recurring path diverges here and returns its own
        // result. Everything above (catalog, ownership, subscription, domain,
        // plan-category and promo validation) is shared; everything below is the
        // one-time `Preference` checkout and is not reached when the flag is on
        // for a `recurring` add-on.
        //
        // No polling job is scheduled for this path. `scheduleAddonCheckoutPolling`
        // exists because a MercadoPago Preference emits no Webhooks v2 delivery
        // at all (HOS-710), so polling is the ONLY confirmation channel for a
        // one-time add-on. A preapproval does deliver v2 events, and PR 5 is the
        // handler that consumes them.
        if (useRecurringCheckout) {
            return await createRecurringAddonCheckout({
                billing,
                addon,
                customerId: input.customerId,
                // Last tier of the payer-email precedence; the cached
                // `mp_payer_email` that outranks it is read inside.
                customerEmail: customer.email,
                userId: input.userId,
                planSubscription: {
                    id: activeSubscription.id,
                    planId: activeSubscription.planId
                },
                orderId,
                successUrl,
                notificationUrl,
                // HOS-606's rule applied to the field this path authorizes on:
                // the preapproval's `reason` is what the buyer reads before
                // agreeing to a recurring debit, so it is resolved by slug in
                // the buyer's language exactly as the one-time line item below.
                locale: input.locale,
                // HOS-1286: the id of the target LISTING, whatever vertical it is.
                // The wire key keeps its accommodation-era name — see below.
                accommodationId: resolveAddonTargetId(input)
            });
        }

        const result = await billing.checkout.create({
            mode: 'payment',
            lineItems: [
                {
                    /**
                     * unitAmount is in centavos (smallest currency unit). The MP adapter
                     * divides by 100 internally when building the preference body — do NOT
                     * pre-divide here.
                     */
                    unitAmount: finalPrice,
                    currency: 'ARS',
                    quantity: 1,
                    // HOS-606: send the buyer's own copy, not the raw English
                    // config literal — the web app already resolves these by
                    // slug (see addon-checkout-locale.ts module doc) and never
                    // shows `addon.name`/`addon.description` verbatim, so a
                    // Spanish-site buyer saw the checkout item in English on
                    // MercadoPago's own payment screen.
                    title: resolveAddonCheckoutName({
                        locale: input.locale,
                        slug: addon.slug,
                        fallback: addon.name
                    }),
                    description: resolveAddonCheckoutDescription({
                        locale: input.locale,
                        slug: addon.slug,
                        fallback: addon.description
                    }),
                    /**
                     * 'services' is the canonical MP category_id for digital SaaS.
                     * Now passed via qzpay's `categoryId` field — the adapter maps it
                     * to `items[].category_id` on the MP preference body.
                     */
                    categoryId: 'services'
                }
            ],
            // HOS-224: the route layer passes locale-prefixed URLs built via
            // buildAddonSuccessUrl/buildAddonCancelUrl. The `?? ${webUrl}/es/...`
            // fallback keeps a valid (locale-prefixed, trailing-slashed) page for
            // any caller that omits them — never the old locale-less
            // `${webUrl}/mi-cuenta/addons?...` that Astro rewrote to a 404.
            successUrl,
            cancelUrl,
            customerId: input.customerId,
            customerEmail: customer.email,
            ...(customerName === undefined ? {} : { customerName }),
            notificationUrl,
            idempotencyKey: checkoutUuid,
            ...(env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR
                ? { statementDescriptor: env.HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR }
                : {}),
            expiresInMinutes: 30,
            /**
             * Metadata is intentionally sent in both snake_case and camelCase formats
             * for backward compatibility.
             *
             * - snake_case keys (e.g. `addon_slug`, `customer_id`): consumed by the
             *   MercadoPago webhook handler, which receives the raw MP payment object
             *   where metadata arrives in snake_case.
             * - camelCase keys (e.g. `addonSlug`, `customerId`): consumed by internal
             *   services (e.g. confirmAddonPurchase) that work with the JS-normalized
             *   representation.
             *
             * Do NOT remove either format without coordinating with the webhook handler
             * and any downstream consumers.
             *
             * `order_id` is added here (not in the original MP path) so the webhook
             * handler can correlate back to the orderId for tracing.
             */
            metadata: {
                addon_slug: addon.slug,
                addonSlug: addon.slug,
                customer_id: input.customerId,
                customerId: input.customerId,
                user_id: input.userId,
                userId: input.userId,
                type: 'addon_purchase',
                order_id: orderId,
                promo_code: input.promoCode || null,
                promo_code_id: promoCodeId || null,
                discount_amount: discountAmount,
                original_price: addon.priceArs,
                // SPEC-309 T-006/T-007: carries the validated target listing
                // across the async payment confirmation, same pattern as promo_code.
                //
                // HOS-1286: the KEY NAME is deliberately unchanged while the value
                // may now be a gastronomy or experience id. Two reasons. A payer who
                // completes a checkout created before this deploy comes back with only
                // this key, so renaming it would drop their target — HOS-675's exact
                // failure, which stayed invisible for months. And the vertical never
                // needed to travel: `confirmAddonPurchase` re-derives it from the
                // add-on's own `productDomain`, which cannot disagree with the add-on
                // the way a second wire field could.
                accommodation_id: resolveAddonTargetId(input) || null,
                accommodationId: resolveAddonTargetId(input) || null
            }
        });

        // Intentionally prod-first (init_point before sandbox_init_point).
        // The original direct-MP path was sandbox-first; this aligns with the
        // qzpay convention used in the annual subscription flow.
        const checkoutUrl = result.providerInitPoint ?? result.providerSandboxInitPoint;

        if (!checkoutUrl) {
            return {
                success: false,
                error: {
                    code: 'CHECKOUT_ERROR',
                    message: 'Failed to get checkout URL from payment provider'
                }
            };
        }

        // Use the session's own expiresAt (qzpay sets it from expiresInMinutes).
        const expiresAt = result.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000);

        // SPEC-143 Finding #21 fallback + SPEC-127 FR-5: enqueue a polling job
        // that activates the addon purchase if the payment webhook fails to arrive.
        // MP Preferences only deliver legacy IPN that the marker filter drops, so
        // the poll cron is the secondary activation path. Non-fatal — a scheduling
        // failure is warned but does not block the checkout response.
        // NOTE: subscriptionId here is a duplicate-job lookup key and lineage
        // reference stored on the polling job — it is NOT the subscription being
        // activated. The addon confirmation (confirmAddonPurchase) re-resolves the
        // active subscription independently at confirmation time. This semantics
        // differs from the annual flow where subscriptionId IS the subscription
        // being activated.
        await scheduleAddonCheckoutPolling({
            billing,
            subscriptionId: activeSubscription.id,
            checkoutSessionId: result.id,
            customerId: input.customerId,
            addonSlug: addon.slug,
            orderId,
            userId: input.userId,
            // HOS-675: only meaningful for target-required addons; every other
            // addon leaves it undefined and the key is omitted from job metadata.
            // HOS-1286: carries any vertical's listing id; see the preference
            // metadata above for why the key name did not change with it.
            accommodationId: resolveAddonTargetId(input),
            // HOS-721: undefined for an undiscounted purchase, in which case
            // every promo key is omitted from the job metadata.
            promoCodeId,
            promoCode: input.promoCode,
            discountAmount: discountAmount > 0 ? discountAmount : undefined
        });

        // NOTE: Promo code usage (incrementUsage + recordUsage) is intentionally
        // NOT recorded here. It is recorded in confirmAddonPurchase() after payment
        // is confirmed, to prevent inflated usage counts from abandoned checkouts.

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug: addon.slug,
                billingType: addon.billingType,
                amount: finalPrice,
                originalAmount: addon.priceArs,
                discountAmount,
                promoCode: input.promoCode,
                orderId,
                checkoutSessionId: result.id
            },
            'Created add-on checkout via qzpay billing'
        );

        return {
            success: true,
            data: {
                checkoutUrl,
                orderId,
                addonId: addon.slug,
                amount: finalPrice,
                currency: 'ARS',
                expiresAt: expiresAt.toISOString()
            }
        };
    } catch (error) {
        // SPEC-149 T-005: QZPayProviderSyncError (thrown when providerSyncErrorStrategy
        // is 'throw', which T-003 made the default) → map to typed ServiceError so the
        // global error handler returns 502/503/504/400 instead of generic 500, and
        // capture to Sentry with billing operation tags (no PII).
        if (isBillingProviderError(error)) {
            const serviceError = mapProviderErrorToServiceError({
                error,
                operation: 'checkout_create'
            });

            // Extract providerStatus from the mapped ServiceError details for Sentry tags.
            const details = serviceError.details as
                | { providerStatus?: number; operation?: string }
                | undefined;

            captureBillingError(serviceError, {
                operation: 'addon_checkout',
                addonIds: [input.addonSlug],
                providerStatus: details?.providerStatus
            });

            // Re-throw so the global error handler maps the ServiceError to the
            // correct HTTP status (502/503/504/400 via ERROR_CODE_TO_HTTP).
            // Polling is never reached — it only runs after a successful checkout.create.
            throw serviceError;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, addonSlug: input.addonSlug },
            'Failed to create add-on checkout'
        );

        return {
            success: false,
            error: {
                code: 'CHECKOUT_ERROR',
                message: 'Failed to create checkout session for add-on purchase'
            }
        };
    }
}

/**
 * Metadata key flipped on a `billing_addon_purchases` row whose target-required
 * add-on confirmed without an accommodationId (HOS-675).
 *
 * Exported so the operator query, the regression test, and any future
 * reconciliation job all name the same key instead of re-typing the string.
 */
export const FEATURED_GRANT_LINK_MISSING_KEY = 'featuredGrantLinkMissing' as const;

/**
 * Flag a confirmed purchase whose `featured_listing_addon_grants` link could not
 * be written, so the defect survives as queryable row state instead of only as a
 * log line.
 *
 * Merges the marker into the existing `metadata` jsonb rather than replacing it,
 * so the context stored at confirmation time is preserved.
 *
 * Deliberately best-effort: it runs after the purchase row is already committed
 * and after the payment was collected, so a failure here must never surface as a
 * failed confirmation (HOS-714 — a payment that cannot be applied is recorded and
 * alerted, never discarded). A failure to write the marker is itself logged.
 *
 * @param params - Purchase to flag, plus customer/add-on context for logging
 */
async function markFeaturedGrantLinkMissing(params: {
    readonly purchaseId: string;
    readonly customerId: string;
    readonly addonSlug: string;
}): Promise<void> {
    const { purchaseId, customerId, addonSlug } = params;

    try {
        const { getDb, eq } = await import('@repo/db');
        const { sql: markerSql } = await import('drizzle-orm');
        const { billingAddonPurchases: bap } = await import('@repo/db/schemas/billing');

        const marker = JSON.stringify({
            [FEATURED_GRANT_LINK_MISSING_KEY]: true,
            featuredGrantLinkMissingAt: new Date().toISOString()
        });

        await getDb()
            .update(bap)
            .set({
                metadata: markerSql`COALESCE(${bap.metadata}, '{}'::jsonb) || ${marker}::jsonb`,
                updatedAt: new Date()
            })
            .where(eq(bap.id, purchaseId));
    } catch (markerError) {
        apiLogger.error(
            {
                purchaseId,
                customerId,
                addonSlug,
                error: markerError instanceof Error ? markerError.message : String(markerError)
            },
            'Failed to flag purchase as featuredGrantLinkMissing; the missing grant link is now only visible in logs and Sentry'
        );
    }
}

/**
 * Confirm an add-on purchase after payment webhook.
 *
 * Inserts a record into `billing_addon_purchases`, computes limit and
 * entitlement adjustments from the add-on definition, and applies them to the
 * subscription metadata for backward compatibility.
 *
 * @param billing - QZPay billing instance
 * @param entitlementService - AddonEntitlementService for applying entitlements
 * @param input - Customer ID, add-on slug, and optional payment context
 * @returns Success or error result
 *
 * @example
 * ```ts
 * const result = await confirmAddonPurchase(billing, entitlementService, {
 *   customerId: 'cust_123',
 *   addonSlug: 'extra-photos',
 *   paymentId: 'pay_789',
 * });
 * ```
 */
export async function confirmAddonPurchase(
    billing: QZPayBilling,
    entitlementService: AddonEntitlementService,
    input: ConfirmPurchaseInput & { tx?: DrizzleClient }
): Promise<ServiceResult<void>> {
    try {
        const addonResult = await addonCatalogService.getBySlug(input.addonSlug);

        if (!addonResult.success) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Add-on '${input.addonSlug}' not found` }
            };
        }

        const addon = addonResult.data;

        const rawSubscriptions = await billing.subscriptions.getByCustomerId(input.customerId);

        if (!rawSubscriptions || rawSubscriptions.length === 0) {
            return {
                success: false,
                error: { code: 'NO_SUBSCRIPTION', message: 'Customer has no active subscription' }
            };
        }

        // HOS-847: see the equivalent selection above (createAddonCheckout) —
        // hydrate and exclude a recurring add-on's own preapproval row so it can
        // never be confirmed as if it were the customer's real subscription.
        const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);
        const grantingSubscriptions = subscriptions.filter(
            (sub) => isEntitlementGrantingStatus(sub.status) && !isAddonSubscription(sub)
        );

        if (grantingSubscriptions.length === 0) {
            return {
                success: false,
                error: {
                    code: 'NO_ACTIVE_SUBSCRIPTION',
                    message: 'Customer has no active subscription'
                }
            };
        }

        // ── Product-domain gate (HOS-1252), mirroring checkout's own (HOS-1178) ──
        //
        // Until this existed, the confirmation picked the FIRST live non-add-on
        // subscription with no domain filter at all. A dual subscriber —
        // gastronomy + accommodation, which the seed file builds
        // `host-provider@local.test` to prove — buying a gastronomy add-on got
        // it attached to whichever row `getByCustomerId` returned first. Measured
        // on staging 2026-09-08: the purchase hung off the ACCOMMODATION
        // subscription's lifecycle (the gastronomy cap died if the owner
        // cancelled their lodging, survived if they cancelled their restaurant)
        // and its limit baseline was read from the accommodation plan, which
        // declares no `max_gastronomies` — `previousValue: 0`, so the paid-for
        // cap never moved. The checkout gate (HOS-1178) already resolves the
        // subscription of the ADD-ON's domain; the confirmation must not be more
        // lax than the sale that gated it.
        const addonProductDomain = addon.productDomain;

        if (!addonProductDomain) {
            // Fail CLOSED, exactly as checkout does before selling and as the
            // entitlement grant does before granting (HOS-1270): an add-on the
            // catalogue cannot classify must not fall back to accommodation.
            // The charge is already collected here, so the refusal is loud —
            // ops needs to see it and refund.
            apiLogger.error(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    paymentId: input.paymentId ?? null
                },
                'Add-on charge confirmed for an add-on that declares no product domain — purchase NOT recorded; ops must refund the collected charge',
                { capture: true }
            );
            return {
                success: false,
                error: {
                    code: 'ADDON_DOMAIN_UNKNOWN',
                    message: `Add-on '${input.addonSlug}' does not declare a product domain and cannot be confirmed`
                }
            };
        }

        const activeSubscription = grantingSubscriptions.find((sub) =>
            subscriptionMatchesDomain(sub, addonProductDomain)
        );

        if (!activeSubscription) {
            // The customer has live subscriptions, but none in the add-on's own
            // domain. Falling back to "any live subscription" here is precisely
            // the HOS-1252 bug — the purchase would hang off the wrong
            // lifecycle and read its limit baseline from the wrong plan. The
            // charge is already collected, so the refusal is loud for ops to
            // refund; the webhook/poll retry that follows will keep failing
            // until the domain subscription is live again, which is the honest
            // answer for money that bought something the owner no longer has.
            apiLogger.error(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    productDomain: addonProductDomain,
                    paymentId: input.paymentId ?? null,
                    amountInCents: input.amountInCents ?? null
                },
                `Add-on charge confirmed but the customer has no live ${addonProductDomain} subscription — purchase NOT recorded; ops must refund the collected charge`,
                { capture: true }
            );
            return {
                success: false,
                error: {
                    code: 'ADDON_NOT_AVAILABLE_FOR_DOMAIN',
                    message: `This add-on requires an active ${addonProductDomain} subscription`
                }
            };
        }

        // Resolve plan limits via PlanService (DB-backed, dual-resolve).
        // Post-SPEC-168, planId may be a UUID or a legacy slug — PlanService handles
        // both. The DB `limits` field is `Record<string, number>` (key → value map).
        // When the plan cannot be resolved, limit baseline defaults to 0 (soft-skip).
        const canonicalPlan = await resolvePlanByIdOrSlug(activeSubscription.planId);

        // HOS-847 PR 5: computed by the shared seam, so the recurring
        // activation path writes the identical arrays. See
        // `addon-purchase-adjustments.ts` for why an empty array here is not a
        // cosmetic difference.
        const { limitAdjustments, entitlementAdjustments } = computeAddonPurchaseAdjustments({
            addon,
            plan: canonicalPlan
        });

        const now = new Date();
        const expiresAt =
            addon.billingType === 'one_time' && addon.durationDays
                ? new Date(now.getTime() + addon.durationDays * 24 * 60 * 60 * 1000)
                : null;

        const { withTransaction } = await import('@repo/db/client');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        // Re-verify the subscription is still active immediately before the DB
        // insert. The initial check at the top of this function happened earlier
        // in the request lifecycle; the subscription could have been cancelled
        // in the window between checkout creation and payment confirmation.
        // HOS-847 added the hydrate + add-on-row exclusion here — a recurring
        // add-on's own preapproval row must not pass the re-verification as
        // "the" subscription. (Until HOS-1252 this comment claimed HOS-847 had
        // also applied a "filter-by-domain fix"; it had not — the predicate below
        // matched ANY live non-add-on subscription, which is exactly the
        // HOS-1252 back door: a re-verify laxer than the selection above would
        // re-admit the wrong-domain row the front gate just rejected.) So the
        // re-verify asks for the SAME domain as the selection above: live,
        // not an add-on row, and matching `addonProductDomain`.
        const rawCurrentSubscriptions = await billing.subscriptions.getByCustomerId(
            input.customerId
        );
        const currentSubscriptions = await hydrateSubscriptionProductDomains(
            rawCurrentSubscriptions ?? []
        );
        const stillActive = currentSubscriptions.find(
            (sub) =>
                isEntitlementGrantingStatus(sub.status) &&
                !isAddonSubscription(sub) &&
                subscriptionMatchesDomain(sub, addonProductDomain)
        );

        if (!stillActive) {
            // The domain-matching subscription was live at the top of this
            // function but is no longer at insert time. The charge was already
            // collected and NO purchase row is written — that combination needs
            // a human (refund), so it is loud on purpose.
            apiLogger.error(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    productDomain: addonProductDomain,
                    paymentId: input.paymentId ?? null,
                    amountInCents: input.amountInCents ?? null
                },
                `Add-on charge confirmed but the customer's ${addonProductDomain} subscription was cancelled during checkout — purchase NOT recorded; ops must refund the collected charge`,
                { capture: true }
            );
            return {
                success: false,
                error: {
                    code: 'SUBSCRIPTION_CANCELLED',
                    message: `Cannot confirm addon purchase: the customer's ${addonProductDomain} subscription was cancelled during checkout`
                }
            };
        }

        // Wrap DB operations in a transaction to ensure atomicity.
        // When input.tx is provided (caller already holds a transaction), reuse it
        // directly via withTransaction's existingTx passthrough to avoid nesting.
        let purchaseId: string;

        const { sql: drizzleSql } = await import('drizzle-orm');

        try {
            const [insertedPurchase] = await withTransaction(async (tx) => {
                // ── SELECT FOR UPDATE: check for existing active purchase ───────
                // Locks any matching row so a concurrent confirmAddonPurchase for
                // the same customer+addon cannot insert a duplicate between this
                // read and the INSERT below (TOCTOU prevention).
                const existing = await tx.execute<{ id: string }>(
                    drizzleSql`SELECT id
                               FROM   billing_addon_purchases
                               WHERE  customer_id = ${input.customerId}
                                 AND  addon_slug  = ${input.addonSlug}
                                 AND  status      = 'active'
                                 AND  deleted_at  IS NULL
                               LIMIT  1
                               FOR UPDATE`
                );

                if (existing.rows.length > 0) {
                    // Throw a sentinel so the outer catch can return the right error
                    // without logging it as an unexpected failure.
                    const err = new Error('ADDON_ALREADY_ACTIVE') as Error & { sentinel: true };
                    err.sentinel = true;
                    throw err;
                }

                return tx
                    .insert(billingAddonPurchases)
                    .values({
                        customerId: input.customerId,
                        subscriptionId: input.subscriptionId || activeSubscription.id,
                        addonSlug: input.addonSlug,
                        // HOS-595: `addon_id` is a FK to `billing_addons` and was
                        // never written, so no purchase could be joined back to the
                        // catalog row it was bought from. The id comes from the same
                        // catalog lookup at the top of this function — the row mapper
                        // simply used to drop it.
                        addonId: addon.id ?? null,
                        status: 'active',
                        purchasedAt: now,
                        expiresAt,
                        paymentId: input.paymentId || null,
                        limitAdjustments,
                        entitlementAdjustments,
                        metadata: input.metadata || {}
                    })
                    .returning({ id: billingAddonPurchases.id });
            }, input.tx);

            if (!insertedPurchase) {
                return {
                    success: false,
                    error: {
                        code: 'INTERNAL_ERROR',
                        message: 'Failed to insert add-on purchase record'
                    }
                };
            }

            purchaseId = insertedPurchase.id;
        } catch (insertError) {
            // Sentinel thrown by the FOR UPDATE check above
            if (
                insertError instanceof Error &&
                'sentinel' in insertError &&
                (insertError as Error & { sentinel: boolean }).sentinel
            ) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_ALREADY_ACTIVE',
                        message: 'Addon already active for this customer'
                    }
                };
            }

            // Postgres unique constraint violation (partial index: active addon per customer)
            if (
                insertError instanceof Error &&
                'code' in insertError &&
                (insertError as { code: string }).code === '23505'
            ) {
                return {
                    success: false,
                    error: {
                        code: 'ADDON_ALREADY_ACTIVE',
                        message: 'Addon already active for this customer'
                    }
                };
            }

            throw insertError;
        }

        apiLogger.info(
            {
                customerId: input.customerId,
                addonSlug: input.addonSlug,
                subscriptionId: activeSubscription.id,
                purchaseId,
                expiresAt: expiresAt?.toISOString() || null,
                limitAdjustments,
                entitlementAdjustments
            },
            'Inserted add-on purchase into billing_addon_purchases table'
        );

        // HOS-595: book the charge in `billing_payments` immediately after the
        // purchase row commits, and BEFORE entitlements are applied — the money
        // is already collected at this point, so the ledger entry must not be
        // conditional on anything that runs later succeeding.
        //
        // Both inputs are required and neither is defaulted: a ledger row needs
        // the provider id to be reconcilable or refundable at all, and a row
        // carrying the catalog list price instead of the charged amount would be
        // a plausible-looking lie the moment a promo code is involved. The caller
        // supplies the amount only for an APPROVED payment, so a rejected charge
        // never lands here as `succeeded`.
        if (input.paymentId && input.amountInCents !== undefined) {
            await recordAddonPayment({
                billing,
                customerId: input.customerId,
                subscriptionId: input.subscriptionId || activeSubscription.id,
                purchaseId,
                addonSlug: input.addonSlug,
                providerPaymentId: input.paymentId,
                amountInCents: input.amountInCents,
                currency: input.currency ?? 'ARS'
            });
        } else {
            apiLogger.error(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    purchaseId,
                    hasPaymentId: Boolean(input.paymentId),
                    hasAmount: input.amountInCents !== undefined
                },
                'Add-on purchase confirmed without a settled provider charge; no billing_payments row written — the charge cannot be reconciled or refunded'
            );
        }

        // SPEC-309 T-007: link the purchase to its target accommodation. T-006
        // validated and carried the accommodationId through checkout.create's
        // metadata; read it back here from the confirmation payload. Soft-fail —
        // a missing/failed grant link must never block purchase confirmation,
        // since the purchase row is already committed and is the source of
        // truth for the customer's limit/entitlement adjustments.
        if (addon.requiresAccommodationTarget) {
            const confirmedAccommodationId =
                typeof input.metadata?.entityId === 'string'
                    ? input.metadata.entityId
                    : typeof input.metadata?.accommodationId === 'string'
                      ? input.metadata.accommodationId
                      : undefined;

            // HOS-1286: which TABLE that id belongs to is re-derived from the
            // add-on's own declared domain, never read off the wire. The metadata
            // could carry a stale or forged type; the add-on cannot disagree with
            // itself. `undefined` here means the add-on names no vertical that owns
            // listings, in which case no grant is written — the fail-closed half of
            // `resolveFeaturableEntityType`.
            const confirmedEntityType = resolveFeaturableEntityType({
                productDomain: addon.productDomain
            });

            if (confirmedAccommodationId && confirmedEntityType) {
                try {
                    const { getDb } = await import('@repo/db');
                    const { featuredListingAddonGrants } = await import('@repo/db/schemas/billing');
                    await getDb().insert(featuredListingAddonGrants).values({
                        purchaseId,
                        entityType: confirmedEntityType,
                        entityId: confirmedAccommodationId
                    });
                } catch (grantLinkError) {
                    apiLogger.error(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            purchaseId,
                            entityType: confirmedEntityType,
                            entityId: confirmedAccommodationId,
                            error:
                                grantLinkError instanceof Error
                                    ? grantLinkError.message
                                    : String(grantLinkError)
                        },
                        'Failed to write featured_listing_addon_grants row'
                    );
                    captureBillingError(
                        grantLinkError instanceof Error
                            ? grantLinkError
                            : new Error(String(grantLinkError)),
                        {
                            addonIds: [addon.slug],
                            transactionId: purchaseId,
                            operation: 'featured_listing_addon_grant_write'
                        },
                        'error'
                    );
                }
            } else {
                // HOS-675: this branch used to be the one that ALWAYS ran. It was
                // written as a "should not happen" race guard, but no production
                // caller of confirmAddonPurchase forwarded `metadata` at all, so
                // every visibility-boost purchase landed here and the grant table
                // stayed empty for months — invisible because a log line plus a
                // Sentry event is the kind of signal nobody queries.
                //
                // The confirmation itself must still succeed: the payment is
                // already collected and the purchase row is already committed, so
                // throwing here would discard money we took (HOS-714 decided a
                // payment that cannot be applied is RECORDED and ALERTED, never
                // discarded). What was missing is the record. Persist a marker on
                // the purchase row so a broken purchase is enumerable with one
                // query instead of only greppable in logs:
                //
                //   SELECT id, customer_id, addon_slug, purchased_at
                //   FROM   billing_addon_purchases
                //   WHERE  metadata->>'featuredGrantLinkMissing' = 'true'
                //     AND  deleted_at IS NULL;
                //
                // That is also what makes the reconciliation SPEC-309 T-007
                // deferred actually possible: the rows can now be found.
                await markFeaturedGrantLinkMissing({
                    purchaseId,
                    customerId: input.customerId,
                    addonSlug: input.addonSlug
                });

                apiLogger.error(
                    {
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        purchaseId,
                        metadataKeys: input.metadata ? Object.keys(input.metadata) : []
                    },
                    'Target-required addon confirmed without a resolvable target (no listing id in metadata, or the add-on declares no vertical that owns listings); featured_listing_addon_grants row NOT written and purchase flagged featuredGrantLinkMissing'
                );
                captureBillingError(
                    new Error('Missing accommodationId at addon purchase confirmation'),
                    {
                        addonIds: [addon.slug],
                        transactionId: purchaseId,
                        operation: 'featured_listing_addon_grant_write'
                    },
                    'error'
                );
            }
        }

        // Clear entitlement cache so the new add-on is reflected immediately
        clearEntitlementCache(input.customerId);

        // Apply entitlements via QZPay. This runs outside the transaction so a
        // QZPay failure does not roll back the confirmed purchase row.
        // On failure the row is flagged for async reconciliation via the
        // addon-expiry cron's Phase 7 grant-reconciliation sweep (SPEC-194 T-012).
        const grantResult = await entitlementService.applyAddonEntitlements({
            customerId: input.customerId,
            addonSlug: input.addonSlug,
            purchaseId
        });

        if (!grantResult.success) {
            apiLogger.warn(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    purchaseId,
                    error: grantResult.error
                },
                'Entitlement grant failed after purchase insert; flagging purchase for async reconciliation'
            );

            // Best-effort: mark the row so the cron reconciliation phase can retry
            // the grant. A failure here is logged but must not roll back the purchase.
            try {
                const { getDb, eq } = await import('@repo/db');
                const { billingAddonPurchases: bap } = await import('@repo/db/schemas/billing');
                await getDb()
                    .update(bap)
                    .set({ needsEntitlementSync: true, updatedAt: new Date() })
                    .where(eq(bap.id, purchaseId));
            } catch (flagError) {
                apiLogger.error(
                    {
                        purchaseId,
                        customerId: input.customerId,
                        addonSlug: input.addonSlug,
                        error: flagError instanceof Error ? flagError.message : String(flagError)
                    },
                    'Failed to set needsEntitlementSync flag; manual reconciliation required'
                );
            }
        }

        // Record promo code usage now that payment is confirmed (GAP-043-049).
        // Doing this here (not at checkout creation) prevents inflating usage
        // counts for abandoned checkouts.
        //
        // HOS-721: these reads are camelCase-only ON PURPOSE. camelCase is the
        // canonical convention; the MercadoPago snake_case wire spelling
        // (`promo_code_id`, `promo_code`, `discount_amount`) is translated away
        // exactly once, by `normalizeAddonCheckoutMetadata` at the webhook
        // border, before this function is ever called. Do NOT "harden" this
        // spot by also reading the snake_case names — a second dual read here
        // is precisely how the two ends drifted apart and how the redemption
        // silently never ran in production.
        const confirmedPromoCodeId =
            typeof input.metadata?.promoCodeId === 'string'
                ? input.metadata.promoCodeId
                : undefined;
        const confirmedPromoCode =
            typeof input.metadata?.promoCode === 'string' ? input.metadata.promoCode : undefined;
        const confirmedDiscountAmount =
            typeof input.metadata?.discountAmount === 'number' ? input.metadata.discountAmount : 0;

        // HOS-721: gated on the promo code ID alone. `promoCode` is the
        // human-facing string and is used for logging only, so requiring it too
        // made a purely cosmetic key able to suppress the redemption.
        if (confirmedPromoCodeId) {
            const promoService = new PromoCodeService();
            const redeemResult = await promoService.redeemAndRecord({
                promoCodeId: confirmedPromoCodeId,
                customerId: input.customerId,
                discountAmount: confirmedDiscountAmount,
                currency: 'ARS'
            });

            if (redeemResult.success) {
                apiLogger.info(
                    {
                        promoCodeId: confirmedPromoCodeId,
                        promoCode: confirmedPromoCode,
                        customerId: input.customerId,
                        discountAmount: confirmedDiscountAmount
                    },
                    'Promo code usage recorded after payment confirmation'
                );
            } else {
                // Non-fatal: log and continue — purchase is already committed
                apiLogger.warn(
                    {
                        promoCodeId: confirmedPromoCodeId,
                        promoCode: confirmedPromoCode,
                        error: redeemResult.error.message
                    },
                    'Failed to record promo code usage after payment confirmation'
                );
            }
        }

        apiLogger.info(
            { customerId: input.customerId, addonSlug: input.addonSlug },
            'Add-on purchase confirmed and entitlements applied'
        );

        // Fire-and-forget: notify the user about the purchase confirmation.
        // Failure is non-blocking — the purchase already succeeded.
        try {
            const customer = await billing.customers.get(input.customerId);
            if (customer) {
                const customerName =
                    typeof customer.metadata?.name === 'string'
                        ? customer.metadata.name
                        : (customer.email ?? 'Usuario');
                const userId =
                    typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;

                // HOS-722: the receipt's CTA must land on the add-ons page
                // (focused on the add-on just bought) in the recipient's own
                // locale. Until this issue, `ADDON_PURCHASE` shared
                // `PurchaseConfirmationPayload` with `SUBSCRIPTION_PURCHASE` and
                // was therefore rendered by the subscription template, whose CTA
                // is a hardcoded `/es/mi-cuenta` link.
                const recipientLocale = await resolveRecipientLocale({ userId });

                sendNotification({
                    type: NotificationType.ADDON_PURCHASE,
                    recipientEmail: customer.email,
                    recipientName: customerName,
                    userId,
                    customerId: input.customerId,
                    // HOS-830: the receipt names the add-on with the SAME
                    // string the buyer read on screen. `addon.name` /
                    // `.description` are English config literals by convention
                    // (see `packages/billing/CLAUDE.md`) that the web never
                    // renders raw — it resolves `account.addons.catalog.<slug>.*`
                    // by slug. Sending the config value straight through is
                    // what made a Spanish buyer's receipt arrive titled
                    // "Add-on adquirido - Visibility Boost (7 days)". This is
                    // the same lookup the MercadoPago checkout line item
                    // already goes through (HOS-606), reused rather than
                    // re-translated in the template: one source, so the email
                    // cannot drift from the screen.
                    addonName: resolveAddonCheckoutName({
                        locale: recipientLocale,
                        slug: input.addonSlug,
                        fallback: addon.name
                    }),
                    addonDescription: resolveAddonCheckoutDescription({
                        locale: recipientLocale,
                        slug: input.addonSlug,
                        fallback: addon.description
                    }),
                    orderId: input.paymentId ?? '',
                    amount: addon.priceArs,
                    currency: 'ARS',
                    expiresAt: expiresAt?.toISOString() ?? null,
                    addonSlug: input.addonSlug,
                    locale: recipientLocale
                }).catch((notifErr) => {
                    apiLogger.debug(
                        {
                            customerId: input.customerId,
                            addonSlug: input.addonSlug,
                            error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                        },
                        'ADDON_PURCHASE notification failed (non-blocking)'
                    );
                });
            }
        } catch (notifLookupErr) {
            apiLogger.debug(
                {
                    customerId: input.customerId,
                    addonSlug: input.addonSlug,
                    error:
                        notifLookupErr instanceof Error
                            ? notifLookupErr.message
                            : String(notifLookupErr)
                },
                'Could not look up customer for ADDON_PURCHASE notification, skipping'
            );
        }

        return { success: true, data: undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        apiLogger.error(
            { error: errorMessage, customerId: input.customerId, addonSlug: input.addonSlug },
            'Failed to confirm add-on purchase'
        );

        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm add-on purchase' }
        };
    }
}
