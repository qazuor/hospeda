/**
 * Turning an authorized recurring add-on preapproval into a granted benefit
 * (HOS-847 PR 5).
 *
 * PR 4 deliberately grants NOTHING at checkout: the purchase row is born
 * `'pending'` with `limit_adjustments: []`, because anyone who abandons
 * MercadoPago's authorization page would otherwise walk away with the add-on
 * for free. This module is the other half — the only place a recurring add-on
 * ever becomes real, and it runs only once MercadoPago says the preapproval is
 * authorized or a charge against it has settled.
 *
 * ## Idempotency is a WHERE clause, not a check
 *
 * The activating UPDATE carries `status = 'pending'` in its own predicate and
 * returns the rows it touched. A MercadoPago redelivery — or the authorization
 * event and the first charge event racing each other, which they routinely do —
 * finds zero rows on the second run and stops there, without a read-then-write
 * window for the two to interleave in. The partial unique index
 * `idx_addon_purchases_active_unique` is the backstop under that: a second
 * ACTIVE purchase of the same add-on by the same customer is rejected by
 * Postgres, and this module reports it rather than crashing the webhook.
 *
 * ## The receipt is NOT `ADDON_PURCHASE`
 *
 * `confirmAddonPurchase` sends `ADDON_PURCHASE`, whose copy says a purchase
 * "has been processed" — true of a one-time add-on and misleading for someone
 * who has just authorised a MercadoPago preapproval that will charge their card
 * again next month. So this path sends `ADDON_SUBSCRIPTION_STARTED` instead,
 * which names the amount, the cadence, the next charge date and how to cancel,
 * in the recipient's own locale (es/en/pt). See
 * `addon-notification-deep-link.guard.test.ts` — this file is on its
 * `DISPATCH_FILES` list and counted in `EXPECTED_DISPATCH_COUNT`.
 *
 * @module services/addon-recurring-activation.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';
import {
    computeInitialAddonPeriod,
    normalizeAddonBillingInterval,
    type RecurringAddonPurchaseRow
} from './addon-recurring-period.js';
import { isUniqueConstraintViolation } from './billing/unique-violation.js';

/*
 * The catalog, entitlement and plan services are reached through `await
 * import(...)` INSIDE the functions below, never as module-scope singletons.
 *
 * This module sits on the import graph of the MercadoPago webhook handlers, and
 * a module-scope `new AddonCatalogService()` executes the moment any of those
 * handlers is imported — including from a test file that partially mocks
 * `@repo/service-core`, which then fails at import time with "No
 * 'AddonCatalogService' export is defined on the mock" for a service it has no
 * business knowing about. Same reason `addon.checkout.ts` reaches `@repo/db`
 * this way. All three are documented stateless, so per-call construction costs
 * nothing at webhook rates.
 */

/** Status a purchase row must be in for activation to do anything. */
const PENDING_STATUS = 'pending' as const;

/** Status activation moves it to. */
const ACTIVE_STATUS = 'active' as const;

/** Input for {@link activateRecurringAddonPurchase}. */
export interface ActivateRecurringAddonPurchaseInput {
    readonly billing: QZPayBilling;
    /** The purchase row, as routed from the preapproval id. */
    readonly purchase: RecurringAddonPurchaseRow;
    /** Instant the period opens at. Injected so tests are deterministic. */
    readonly activatedAt: Date;
    /**
     * MercadoPago payment id, when activation was triggered by a settled
     * charge. `undefined` when triggered by `preapproval.updated`, which
     * carries no payment.
     */
    readonly providerPaymentId?: string | undefined;
    /** For log correlation only. */
    readonly triggerSource: string;
}

/**
 * Why activation did nothing, when it did nothing.
 *
 * `already-settled` is the ordinary case (a redelivery, or the sibling event
 * won the race) and is not a problem. The other two are, and are logged as
 * such.
 */
export type RecurringAddonActivationSkipReason =
    | 'already-settled'
    | 'addon-not-in-catalog'
    | 'duplicate-active-purchase';

/** Outcome of {@link activateRecurringAddonPurchase}. */
export type RecurringAddonActivationOutcome =
    | { readonly activated: true }
    | { readonly activated: false; readonly reason: RecurringAddonActivationSkipReason };

/**
 * Read the plan id of the subscription an add-on purchase hangs off.
 *
 * `billing_addon_purchases.subscription_id` holds the customer's PLAN
 * subscription (never the add-on's own preapproval row — see that column's
 * comment), so this resolves the BASE limits the purchase's `limit_adjustments`
 * are measured against.
 *
 * @param subscriptionId - The plan subscription's local id, or `null`.
 * @returns The plan id, or `null` when it cannot be resolved.
 */
async function resolvePlanIdOfSubscription(subscriptionId: string | null): Promise<string | null> {
    if (!subscriptionId) {
        return null;
    }
    const { getDb, billingSubscriptions, eq } = await import('@repo/db');
    const rows = await getDb()
        .select({ planId: billingSubscriptions.planId })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId))
        .limit(1);
    return rows[0]?.planId ?? null;
}

/**
 * Mirror the activation onto the add-on's OWN `billing_subscriptions` row.
 *
 * That row is created `incomplete` by qzpay's `mode: 'paid'` insert. Left
 * behind, it reads as an abandoned checkout while MercadoPago charges the card
 * every month — the HOS-751 shape PR 6 will query for, and PR 7 will reconcile.
 *
 * ## This is the first `product_domain = 'addon'` row to become LIVE, and the
 * exclusions are per-reader, not global
 *
 * PR 2 gave every plan-shaped CRON an add-on exclusion, and this UPDATE is what
 * makes those exclusions load-bearing rather than theoretical. It is emphatically
 * NOT true that "every sweep" excludes these rows: `TrialService` reaches
 * subscriptions through `billing.subscriptions.getByCustomerId()` — which does
 * not even populate `productDomain` (HOS-1104, see
 * `hydrateSubscriptionProductDomains`) — and had to be given the filter
 * separately (`getTrialStatus`, `reactivateSubscription`,
 * `reconcileDuplicateSubscriptions`). Anything else that resolves "the
 * customer's subscription" from a status alone needs the same treatment before
 * an `active` add-on row can outrank a real plan row.
 *
 * The `product_domain` predicate is load-bearing, not decoration: it makes it
 * structurally impossible for this UPDATE to touch a plan subscription even if
 * the preapproval id were somehow wrong.
 *
 * Never throws — the benefit is already granted and the money already taken; a
 * status mirror failing must not turn that into a webhook retry.
 *
 * @param params.mpSubscriptionId - The add-on's preapproval id.
 * @param params.purchaseId - For the log line only.
 */
async function syncAddonSubscriptionRowToActive(params: {
    readonly mpSubscriptionId: string | null;
    readonly purchaseId: string;
}): Promise<void> {
    const { mpSubscriptionId, purchaseId } = params;
    if (!mpSubscriptionId) {
        return;
    }

    try {
        const { getDb, billingSubscriptions, and, eq, isNull } = await import('@repo/db');
        const { ProductDomainEnum, SubscriptionStatusEnum } = await import('@repo/schemas');

        await getDb()
            .update(billingSubscriptions)
            .set({ status: SubscriptionStatusEnum.ACTIVE, updatedAt: new Date() })
            .where(
                and(
                    eq(billingSubscriptions.mpSubscriptionId, mpSubscriptionId),
                    eq(billingSubscriptions.productDomain, ProductDomainEnum.ADDON),
                    isNull(billingSubscriptions.deletedAt),
                    // `pending_provider` is the exact status
                    // `createOwnPreapprovalSubscription` writes, and the only one
                    // this mirror may leave. Anything else — cancelled, already
                    // active — is somebody else's decision to keep.
                    eq(billingSubscriptions.status, SubscriptionStatusEnum.PENDING_PROVIDER)
                )
            );
    } catch (error) {
        apiLogger.error(
            {
                purchaseId,
                mpSubscriptionId,
                error: error instanceof Error ? error.message : String(error)
            },
            "HOS-847: could not mirror an add-on activation onto its own billing_subscriptions row — the add-on is granted, but its subscription row still reads as an unfinished checkout (PR 7's reconciler must correct this)",
            { capture: true }
        );
    }
}

/**
 * Link a target-required add-on to the accommodation it was bought for.
 *
 * Mirrors the block `confirmAddonPurchase` runs for the one-time path (SPEC-309
 * T-007 / HOS-675). No recurring add-on in today's catalog requires a target,
 * so this is dormant — and it exists exactly because HOS-675 showed what
 * happens when it is not there: the grant table stayed empty for months without
 * anything failing.
 *
 * Soft-fail: the purchase is already active and the entitlement already granted.
 *
 * @param params.purchaseId - The activated purchase.
 * @param params.accommodationId - Target read from the purchase metadata.
 */
async function linkFeaturedGrantBestEffort(params: {
    readonly purchaseId: string;
    readonly accommodationId: string;
}): Promise<void> {
    try {
        const { getDb } = await import('@repo/db');
        const { featuredListingAddonGrants } = await import('@repo/db/schemas/billing');
        await getDb()
            .insert(featuredListingAddonGrants)
            .values({ purchaseId: params.purchaseId, accommodationId: params.accommodationId });
    } catch (error) {
        apiLogger.error(
            {
                purchaseId: params.purchaseId,
                accommodationId: params.accommodationId,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: failed to write featured_listing_addon_grants row for a recurring add-on activation'
        );
    }
}

/**
 * Send the recurring add-on's subscription notice (HOS-847 PR 5).
 *
 * Not `ADDON_PURCHASE`: see this module's own JSDoc. Everything a SUBSCRIBER
 * has to be told and a one-time buyer does not — the cadence, the next charge
 * date, and how to cancel — is required on
 * `AddonSubscriptionStartedPayload`, so a dispatch cannot silently degrade into
 * the one-time message by omitting a field.
 *
 * Best-effort and non-blocking, matching `confirmAddonPurchase`: the money is
 * taken and the benefit granted before this runs, so a mail failure must never
 * turn a successful activation into a webhook retry. Everything is inside a
 * `try` — including the customer lookup, which is a network call.
 *
 * @param params.billing - Resolved qzpay billing facade.
 * @param params.purchase - The just-activated purchase row.
 * @param params.addon - The catalog entry, for the fallback name/description.
 * @param params.amountInCents - Amount charged now and on every renewal.
 * @param params.nextChargeAt - End of the period this activation opened.
 * @param params.triggerSource - For log correlation.
 */
async function sendSubscriptionStartedNotice(params: {
    readonly billing: QZPayBilling;
    readonly purchase: RecurringAddonPurchaseRow;
    readonly addon: { readonly name: string; readonly description: string; readonly slug: string };
    readonly amountInCents: number;
    readonly nextChargeAt: Date;
    readonly triggerSource: string;
}): Promise<void> {
    const { billing, purchase, addon, amountInCents, nextChargeAt, triggerSource } = params;

    try {
        const customer = await billing.customers.get(purchase.customerId);
        if (!customer?.email) {
            apiLogger.warn(
                { purchaseId: purchase.id, customerId: purchase.customerId, triggerSource },
                'HOS-847: recurring add-on activated but the customer has no email — subscription notice not sent'
            );
            return;
        }

        const { NotificationType } = await import('@repo/notifications');
        const { sendNotification } = await import('../utils/notification-helper.js');
        const { resolveRecipientLocale } = await import('./notification-recipient-locale.js');
        const { resolveAddonCheckoutDescription, resolveAddonCheckoutName } = await import(
            './addon-checkout-locale.js'
        );

        const userId =
            typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;
        const customerName =
            typeof customer.metadata?.name === 'string' ? customer.metadata.name : customer.email;
        const recipientLocale = await resolveRecipientLocale({ userId });

        await sendNotification({
            type: NotificationType.ADDON_SUBSCRIPTION_STARTED,
            recipientEmail: customer.email,
            recipientName: customerName,
            userId,
            customerId: purchase.customerId,
            // HOS-830: name the add-on with the SAME string the buyer read on
            // screen, resolved by slug, rather than the English config literal.
            addonName: resolveAddonCheckoutName({
                locale: recipientLocale,
                slug: purchase.addonSlug,
                fallback: addon.name
            }),
            addonDescription: resolveAddonCheckoutDescription({
                locale: recipientLocale,
                slug: purchase.addonSlug,
                fallback: addon.description
            }),
            amount: amountInCents,
            currency: 'ARS',
            billingInterval: normalizeAddonBillingInterval(purchase.billingInterval),
            nextChargeAt: nextChargeAt.toISOString(),
            addonSlug: purchase.addonSlug,
            locale: recipientLocale
        });
    } catch (error) {
        apiLogger.error(
            {
                purchaseId: purchase.id,
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                triggerSource,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: could not send the recurring add-on subscription notice — the customer is subscribed and has not been told when they will be charged again',
            { capture: true }
        );
    }
}

/**
 * Move a `'pending'` recurring add-on purchase to `'active'` and grant what it
 * bought.
 *
 * Ordering, and why:
 *  1. Catalog + base plan reads, so the adjustment arrays can be computed. A
 *     plan that will not resolve yields a baseline of `0`, matching the
 *     one-time path's soft-skip.
 *  2. The conditional UPDATE. Everything after this point runs at most once per
 *     purchase, because only the caller that won this UPDATE gets here.
 *  3. Cache clear, then the featured-listing LINK, then the grant. The customer
 *     is already paying, so a stale 5-minute entitlement cache would answer 402
 *     to someone who just paid (INV-1); and the link has to precede the grant
 *     because `applyAddonEntitlements` READS
 *     `featured_listing_addon_grants` — the one-time path in
 *     `addon.checkout.ts` orders it the same way, for the same reason (HOS-675).
 *  4. Failures after the UPDATE flag `needs_entitlement_sync` rather than
 *     rolling anything back — the money is collected and the row is committed,
 *     so the sweep that already exists for exactly this (`addon-expiry` phase
 *     7) is the recovery path.
 *
 * ## It CAN throw, and callers must guard
 *
 * Everything after the conditional UPDATE is guarded; everything BEFORE it is
 * not, on purpose. The catalog lookup, the base-plan read
 * (`resolvePlanIdOfSubscription`, a bare `getDb().select(...)`),
 * `resolvePlanByIdOrSlug` and `clearEntitlementCache` all propagate. That is
 * correct — a transient database failure before anything has been claimed
 * should be retried, not swallowed into a permanent "not activated" — but it
 * means a caller CANNOT treat this as total. Both call sites
 * (`routeAddonPreapprovalEvent` and `settleRecurringAddonCharge`) wrap it, and
 * the renewal path additionally books the money BEFORE calling it, so a throw
 * here can never take a settled charge down with it.
 *
 * @param input - See {@link ActivateRecurringAddonPurchaseInput}.
 * @returns Whether this call activated the purchase.
 * @throws When the catalog, plan or cache reads that precede the claiming
 *   UPDATE fail. Never after it.
 */
export async function activateRecurringAddonPurchase(
    input: ActivateRecurringAddonPurchaseInput
): Promise<RecurringAddonActivationOutcome> {
    const { billing, purchase, activatedAt, providerPaymentId, triggerSource } = input;

    if (purchase.status !== PENDING_STATUS) {
        return { activated: false, reason: 'already-settled' };
    }

    const { AddonCatalogService } = await import('@repo/service-core');
    const addonResult = await new AddonCatalogService().getBySlug(purchase.addonSlug);
    if (!addonResult.success) {
        apiLogger.error(
            { purchaseId: purchase.id, addonSlug: purchase.addonSlug, triggerSource },
            'HOS-847: a recurring add-on preapproval was authorized for a slug the catalog does not know — the purchase stays pending and nothing is granted',
            { capture: true }
        );
        return { activated: false, reason: 'addon-not-in-catalog' };
    }
    const addon = addonResult.data;

    const { computeAddonPurchaseAdjustments, resolvePlanByIdOrSlug } = await import(
        './addon-purchase-adjustments.js'
    );
    const planId = await resolvePlanIdOfSubscription(purchase.subscriptionId);
    const plan = planId === null ? null : await resolvePlanByIdOrSlug(planId);
    const { limitAdjustments, entitlementAdjustments } = computeAddonPurchaseAdjustments({
        addon,
        plan
    });

    const period = computeInitialAddonPeriod({
        from: activatedAt,
        billingInterval: normalizeAddonBillingInterval(purchase.billingInterval)
    });

    let claimed: Array<{ id: string }>;
    try {
        const { getDb, and, eq, isNull } = await import('@repo/db');
        const { billingAddonPurchases } = await import('@repo/db/schemas/billing');

        claimed = await getDb()
            .update(billingAddonPurchases)
            .set({
                status: ACTIVE_STATUS,
                limitAdjustments,
                entitlementAdjustments,
                currentPeriodStart: period.currentPeriodStart,
                currentPeriodEnd: period.currentPeriodEnd,
                // `purchased_at` deliberately untouched: it records when the
                // buyer bought, and the checkout already wrote it.
                ...(providerPaymentId === undefined ? {} : { paymentId: providerPaymentId }),
                needsEntitlementSync: false,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(billingAddonPurchases.id, purchase.id),
                    // THE idempotency guard. Two concurrent webhooks both reach
                    // here; exactly one gets a row back.
                    eq(billingAddonPurchases.status, PENDING_STATUS),
                    isNull(billingAddonPurchases.deletedAt)
                )
            )
            .returning({ id: billingAddonPurchases.id });
    } catch (error) {
        // `isUniqueConstraintViolation`, never `error.code`. Drizzle wraps EVERY
        // query failure in a `DrizzleQueryError` that carries `query`, `params`
        // and `cause` and has NO `code` of its own, so a predicate reading
        // `error.code` on what this `catch` actually receives is always false —
        // the branch below would never run and a lost race would surface as an
        // unhandled 500 inside a webhook. That shape is verified against a real
        // PostgreSQL unique violation; see the helper's module JSDoc.
        if (isUniqueConstraintViolation({ error })) {
            // `idx_addon_purchases_active_unique`: this customer already has an
            // ACTIVE purchase of this add-on. Two live preapprovals for one
            // add-on is a HOS-751-class state — the second one charges with
            // nothing to show for it — so this is an alert, not a debug line.
            apiLogger.error(
                {
                    purchaseId: purchase.id,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    mpSubscriptionId: purchase.mpSubscriptionId,
                    triggerSource
                },
                'HOS-847: a recurring add-on preapproval was authorized while another purchase of the same add-on is already active — this preapproval will charge with nothing granted and must be cancelled manually',
                { capture: true }
            );
            return { activated: false, reason: 'duplicate-active-purchase' };
        }
        throw error;
    }

    if (claimed.length === 0) {
        return { activated: false, reason: 'already-settled' };
    }

    // The customer just gained a paid benefit; do not make them wait out the
    // 5-minute entitlement cache to use what they are being charged for.
    clearEntitlementCache(purchase.customerId);

    // BEFORE the grant, matching the one-time path (`addon.checkout.ts` links at
    // ~1192 and grants at ~1288) and for the same reason: `applyAddonEntitlements`
    // READS `featured_listing_addon_grants` by `purchaseId` to decide whether to
    // flip `accommodations.featuredByEntitlement`. Granting first means that read
    // finds nothing, and nothing fails — which is precisely HOS-675, where the
    // table sat empty for months while every log line said success. Dormant today
    // (both `requiresAccommodationTarget` add-ons are one-time), so the ORDER is
    // the whole of what is being fixed here.
    if (addon.requiresAccommodationTarget) {
        const accommodationId = purchase.metadata?.accommodationId;
        if (typeof accommodationId === 'string' && accommodationId.length > 0) {
            await linkFeaturedGrantBestEffort({ purchaseId: purchase.id, accommodationId });
        } else {
            apiLogger.error(
                { purchaseId: purchase.id, addonSlug: purchase.addonSlug, triggerSource },
                'HOS-847: target-required recurring add-on activated with no accommodationId in its purchase metadata; featured_listing_addon_grants row NOT written',
                { capture: true }
            );
        }
    }

    const { AddonEntitlementService } = await import('./addon-entitlement.service.js');
    const entitlementService = new AddonEntitlementService(billing);
    const grantResult = await entitlementService.applyAddonEntitlements({
        customerId: purchase.customerId,
        addonSlug: purchase.addonSlug,
        purchaseId: purchase.id
    });

    if (!grantResult.success) {
        apiLogger.warn(
            {
                purchaseId: purchase.id,
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                error: grantResult.error,
                triggerSource
            },
            'HOS-847: entitlement grant failed after a recurring add-on activation; flagging for the addon-expiry reconciliation sweep'
        );
        try {
            const { getDb, eq } = await import('@repo/db');
            const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
            await getDb()
                .update(billingAddonPurchases)
                .set({ needsEntitlementSync: true, updatedAt: new Date() })
                .where(eq(billingAddonPurchases.id, purchase.id));
        } catch (flagError) {
            apiLogger.error(
                {
                    purchaseId: purchase.id,
                    error: flagError instanceof Error ? flagError.message : String(flagError)
                },
                'HOS-847: failed to set needsEntitlementSync after a failed recurring add-on grant; manual reconciliation required',
                // The worst of the four. The purchase is `active`, the money is
                // collected, the grant failed, and the flag that would have put
                // it in front of `addon-expiry` phase 7 was not written either:
                // nothing else will ever notice this row.
                { capture: true }
            );
        }
    }

    await syncAddonSubscriptionRowToActive({
        mpSubscriptionId: purchase.mpSubscriptionId,
        purchaseId: purchase.id
    });

    // Reached only by the caller that WON the conditional UPDATE, so the notice
    // goes out exactly once per purchase — a redelivery finds zero rows above
    // and returns long before here.
    await sendSubscriptionStartedNotice({
        billing,
        purchase,
        addon: {
            name: addon.name,
            description: addon.description ?? '',
            slug: purchase.addonSlug
        },
        // `AddonDefinition.priceArs` is ALREADY centavos ("Monthly price in ARS
        // cents", `addon.types.ts`) — the same field `confirmAddonPurchase`
        // hands straight to `ADDON_PURCHASE.amount`, which the template divides
        // by 100. Multiplying here would mail a 100× charge (HOS-713/HOS-839
        // is that class of bug in the other direction).
        amountInCents: addon.priceArs,
        nextChargeAt: period.currentPeriodEnd,
        triggerSource
    });

    apiLogger.info(
        {
            purchaseId: purchase.id,
            customerId: purchase.customerId,
            addonSlug: purchase.addonSlug,
            mpSubscriptionId: purchase.mpSubscriptionId,
            currentPeriodStart: period.currentPeriodStart.toISOString(),
            currentPeriodEnd: period.currentPeriodEnd.toISOString(),
            limitAdjustments,
            entitlementAdjustments,
            triggerSource
        },
        'HOS-847: recurring add-on purchase activated from its MercadoPago preapproval'
    );

    return { activated: true };
}
