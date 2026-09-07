/**
 * Routing: a MercadoPago preapproval that belongs to an ADD-ON never reaches
 * the plan-subscription handlers (HOS-847 PR 5).
 *
 * ## Why this has to exist, and has to run first
 *
 * PR 4 creates a real preapproval per recurring add-on and writes a
 * `billing_subscriptions` row for it (`product_domain = 'addon'`). Both
 * plan-side entry points resolve their subject purely by
 * `billing_subscriptions.mp_subscription_id`, with **no domain filter**:
 * `processSubscriptionUpdated` (`subscription-logic.ts` step 5) and
 * `findLocalSubscriptionByPreapprovalId` (`subscription-payment-handler.ts`).
 * They would both find the add-on's row and be perfectly happy with it — and
 * then run a customer's entire subscription lifecycle against an add-on: status
 * transitions, plan-change add-on recalculation, cancellation of every add-on
 * they own, featured-listing sync, entity-subscription cache reconcile,
 * "your subscription is active" mail, and a recurring-charge ledger row
 * attributed to their plan. A single add-on's ARS 5.000 charge would read as
 * the customer's plan renewing.
 *
 * So the interception is placed at the two points where the preapproval id is
 * first known and BEFORE any local subscription is looked up:
 *
 *  - `processSubscriptionUpdated` step 1, which covers all three of its callers
 *    (the live webhook, the dead-letter retry cron, and the polling job) rather
 *    than only the webhook, and
 *  - `handleSubscriptionAuthorizedPayment`, immediately after the
 *    authorized-payment REST fetch — the earliest moment a preapproval id
 *    exists at all on that path, since the IPN only carries an
 *    authorized-payment id.
 *
 * ## Deliberately NOT behind the feature flag
 *
 * `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` gates the CHECKOUT. Gating the
 * routing too would create the worst state in the chain: turn the flag on, sell
 * a few add-ons, turn it back off, and every live preapproval's charge starts
 * being processed as a plan renewal. A preapproval outlives the flag that
 * created it. The routing is instead a no-op by construction — with no add-on
 * purchase carrying that preapproval id, the lookup returns `null` and the plan
 * handler proceeds untouched, which is exactly today's behaviour.
 *
 * @module routes/webhooks/mercadopago/addon-recurring-handler
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { activateRecurringAddonPurchase } from '../../../services/addon-recurring-activation.service.js';
import { findRecurringAddonPurchaseByPreapprovalId } from '../../../services/addon-recurring-period.js';
import { settleRecurringAddonCharge } from '../../../services/addon-recurring-renewal.service.js';
import { apiLogger } from '../../../utils/logger.js';
import type { MPAuthorizedPaymentDetails } from '../../../utils/mp-authorized-payment.js';
import { mapMpStatusToQZPayStatus } from '../../../utils/mp-payment-status.js';

/**
 * QZPay subscription status that means "MercadoPago authorized this
 * preapproval". MP's own `authorized` is normalized to this by
 * `@qazuor/qzpay-mercadopago` before anything here sees it, and
 * `QZPAY_TO_HOSPEDA_STATUS` maps it on to `ACTIVE` for plan subscriptions.
 */
const QZPAY_AUTHORIZED_STATUS = 'active';

/**
 * Outcome of a routing attempt.
 *
 * `handled: false` is the ONLY value that lets the caller continue into the
 * plan-subscription path. Every other case — including an add-on event this
 * module deliberately does nothing about — returns `handled: true`, because
 * "we recognised this as an add-on and chose not to act" must never degrade
 * into "the plan handler acts on it instead".
 */
export type AddonRoutingOutcome =
    | { readonly handled: false }
    | { readonly handled: true; readonly purchaseId: string };

/**
 * Route a `subscription_preapproval.{created,updated}` event.
 *
 * Called from `processSubscriptionUpdated` before it retrieves anything from
 * MercadoPago or looks at `billing_subscriptions`.
 *
 * On an authorized preapproval, activates the pending purchase — idempotently;
 * see `addon-recurring-activation.service.ts`. Every other provider status is
 * recognised, logged and left alone:
 *
 *  - `paused` / `canceled` / `finished` — revoking what the customer bought is
 *    PR 6's (cancellation) and PR 7's (reconciler) job, and doing half of it
 *    here would leave the QZPay entitlement granted while the purchase row said
 *    otherwise. `loadEntitlements` reads QZPay's tables, not this one, so a row
 *    marked `canceled` without a `revokeBySource` call keeps the benefit alive.
 *    **Obligation left for PR 7**: its reconciler is currently the only thing
 *    that will ever notice one of these.
 *  - `past_due` — kept out of subscription dunning by design (plan OQ-3).
 *  - `pending` — the buyer has not authorized yet; nothing to do.
 *
 * ## Two different failure policies, on purpose
 *
 * The ROUTING lookup itself is fail-CLOSED: if the database read that decides
 * "add-on or plan?" fails, the error propagates. A caller that cannot tell the
 * two apart must retry, never guess "plan" — guessing is the exact bug this
 * routing exists to prevent.
 *
 * Everything AFTER the row is identified is fail-OPEN-but-consumed: the answer
 * is known ("this is an add-on"), so a failure to act on it is logged and
 * captured while the event is still marked handled. Falling through to the plan
 * handler because the add-on work failed would be strictly worse than dropping
 * the event.
 *
 * @param params.preapprovalId - MercadoPago preapproval id from the event.
 * @param params.billing - Resolved qzpay billing facade.
 * @param params.paymentAdapter - Used to read the preapproval's current status.
 * @param params.triggerSource - For log correlation (`webhook`, `cron`, ...).
 * @returns Whether the event belonged to an add-on and was consumed here.
 */
export async function routeAddonPreapprovalEvent(params: {
    readonly preapprovalId: string;
    readonly billing: QZPayBilling;
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    readonly triggerSource: string;
}): Promise<AddonRoutingOutcome> {
    const { preapprovalId, billing, paymentAdapter, triggerSource } = params;

    const purchase = await findRecurringAddonPurchaseByPreapprovalId(preapprovalId);
    if (!purchase) {
        return { handled: false };
    }

    try {
        const mpSubscription = await paymentAdapter.subscriptions.retrieve(preapprovalId);

        if (mpSubscription.status === QZPAY_AUTHORIZED_STATUS) {
            await activateRecurringAddonPurchase({
                billing,
                purchase,
                activatedAt: new Date(),
                triggerSource
            });
        } else {
            apiLogger.info(
                {
                    purchaseId: purchase.id,
                    customerId: purchase.customerId,
                    addonSlug: purchase.addonSlug,
                    mpSubscriptionId: preapprovalId,
                    providerStatus: mpSubscription.status,
                    purchaseStatus: purchase.status,
                    triggerSource
                },
                "HOS-847: add-on preapproval event recognised and intentionally not acted on — revocation and provider reconciliation are later PRs' work"
            );
        }
    } catch (error) {
        // Logged loudly and still consumed. Letting this fall through to the
        // plan handler because OUR side failed would be strictly worse than
        // dropping the event: the plan handler would then act on the add-on.
        apiLogger.error(
            {
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: preapprovalId,
                triggerSource,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: failed to process an add-on preapproval event — event consumed anyway so it can never be handled as a plan subscription',
            { capture: true }
        );
    }

    return { handled: true, purchaseId: purchase.id };
}

/**
 * Route a `subscription_authorized_payment.{created,updated}` event.
 *
 * Called from `handleSubscriptionAuthorizedPayment` immediately after the
 * authorized-payment REST fetch and BEFORE `findLocalSubscriptionByPreapprovalId`
 * — which, absent this call, would resolve the add-on's own
 * `billing_subscriptions` row and book the charge as a plan renewal, then try
 * to convert a trial on it.
 *
 * The details object is passed in rather than re-fetched: one MercadoPago
 * round-trip, and no chance of the two paths reasoning about different
 * payloads.
 *
 * Same two failure policies as {@link routeAddonPreapprovalEvent}: the routing
 * lookup fails CLOSED (the error propagates, and the caller's own catch marks
 * the event failed so the dead-letter cron retries it), while a failure to
 * settle an already-identified add-on charge is logged and the event still
 * consumed.
 *
 * @param params.details - The already-fetched authorized payment.
 * @param params.billing - Resolved qzpay billing facade.
 * @param params.triggerSource - For log correlation.
 * @returns Whether the charge belonged to an add-on and was consumed here.
 */
export async function routeAddonAuthorizedPayment(params: {
    readonly details: MPAuthorizedPaymentDetails;
    readonly billing: QZPayBilling;
    readonly triggerSource: string;
}): Promise<AddonRoutingOutcome> {
    const { details, billing, triggerSource } = params;

    const purchase = await findRecurringAddonPurchaseByPreapprovalId(details.preapprovalId);
    if (!purchase) {
        return { handled: false };
    }

    try {
        const outcome = await settleRecurringAddonCharge({
            billing,
            purchase,
            details,
            status: mapMpStatusToQZPayStatus(details),
            // OUR clock, never MercadoPago's dates — HOS-1012.
            settledAt: new Date(),
            triggerSource
        });

        apiLogger.info(
            {
                purchaseId: purchase.id,
                customerId: purchase.customerId,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: details.preapprovalId,
                mpPaymentId: details.paymentId,
                activated: outcome.activated,
                ledgerInserted: outcome.ledgerInserted,
                periodAdvanced: outcome.periodAdvanced,
                triggerSource
            },
            'HOS-847: add-on recurring charge routed away from the plan handler and settled'
        );
    } catch (error) {
        apiLogger.error(
            {
                purchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: details.preapprovalId,
                mpPaymentId: details.paymentId,
                triggerSource,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-847: failed to settle an add-on recurring charge — event consumed anyway so it can never be booked as a plan renewal',
            { capture: true }
        );
    }

    return { handled: true, purchaseId: purchase.id };
}
