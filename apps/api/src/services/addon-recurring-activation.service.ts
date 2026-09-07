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
 * ## What it deliberately does not do
 *
 * No `ADDON_PURCHASE` receipt is sent. The copy for a recurring add-on has to
 * say "this renews and you will be charged again", which is PR 8's job; sending
 * the one-time purchase template here would tell a subscriber the opposite of
 * the truth. See `addon-notification-deep-link.guard.test.ts` — adding a
 * dispatch means adding this file to its list and bumping its count.
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

/** Postgres unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = '23505';

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
 * That row is created `incomplete` by qzpay's `mode: 'paid'` insert and nothing
 * else will ever move it: PR 2 excluded `product_domain = 'addon'` rows from
 * every sweep, precisely so a plan-shaped cron could not act on one. Left
 * behind, it reads as an abandoned checkout while MercadoPago charges the card
 * every month — the HOS-751 shape PR 6 will query for, and PR 7 will reconcile.
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
            "HOS-847: could not mirror an add-on activation onto its own billing_subscriptions row — the add-on is granted, but its subscription row still reads as an unfinished checkout (PR 7's reconciler must correct this)"
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
 * Move a `'pending'` recurring add-on purchase to `'active'` and grant what it
 * bought.
 *
 * Ordering, and why:
 *  1. Catalog + base plan reads, so the adjustment arrays can be computed. A
 *     plan that will not resolve yields a baseline of `0`, matching the
 *     one-time path's soft-skip.
 *  2. The conditional UPDATE. Everything after this point runs at most once per
 *     purchase, because only the caller that won this UPDATE gets here.
 *  3. Cache clear BEFORE the grant, then the grant. The customer is already
 *     paying; a stale 5-minute entitlement cache would answer 402 to someone
 *     who just paid (INV-1).
 *  4. Failures after the UPDATE flag `needs_entitlement_sync` rather than
 *     rolling anything back — the money is collected and the row is committed,
 *     so the sweep that already exists for exactly this (`addon-expiry` phase
 *     7) is the recovery path.
 *
 * Never throws. Every caller is a webhook whose event must still be acked.
 *
 * @param input - See {@link ActivateRecurringAddonPurchaseInput}.
 * @returns Whether this call activated the purchase.
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
            'HOS-847: a recurring add-on preapproval was authorized for a slug the catalog does not know — the purchase stays pending and nothing is granted'
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
        if (
            error instanceof Error &&
            'code' in error &&
            (error as { code?: string }).code === UNIQUE_VIOLATION
        ) {
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
                'HOS-847: a recurring add-on preapproval was authorized while another purchase of the same add-on is already active — this preapproval will charge with nothing granted and must be cancelled manually'
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
                'HOS-847: failed to set needsEntitlementSync after a failed recurring add-on grant; manual reconciliation required'
            );
        }
    }

    if (addon.requiresAccommodationTarget) {
        const accommodationId = purchase.metadata?.accommodationId;
        if (typeof accommodationId === 'string' && accommodationId.length > 0) {
            await linkFeaturedGrantBestEffort({ purchaseId: purchase.id, accommodationId });
        } else {
            apiLogger.error(
                { purchaseId: purchase.id, addonSlug: purchase.addonSlug, triggerSource },
                'HOS-847: target-required recurring add-on activated with no accommodationId in its purchase metadata; featured_listing_addon_grants row NOT written'
            );
        }
    }

    await syncAddonSubscriptionRowToActive({
        mpSubscriptionId: purchase.mpSubscriptionId,
        purchaseId: purchase.id
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
