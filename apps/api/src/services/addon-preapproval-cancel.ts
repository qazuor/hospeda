/**
 * Closing the PROVIDER side of a recurring add-on before the local row goes
 * terminal (HOS-847 PR 6 — the fix for the HOS-751 shape, one table over).
 *
 * ## The failure this exists to make impossible
 *
 * HOS-751 was a `billing_subscriptions` row written to `cancelled` while its
 * MercadoPago preapproval stayed `authorized`: the provider kept charging a card
 * on a schedule no local row explained any more. `preapproval-hard-cancel.ts`
 * closed that hole for subscriptions.
 *
 * A recurring add-on reintroduces the exact same shape on
 * `billing_addon_purchases`, because a recurring add-on now has a preapproval of
 * its very own (`mp_subscription_id`, written by
 * `createRecurringAddonCheckout`), reachable from NOTHING else — in particular
 * not through `subscription_id`, which holds the customer's PLAN subscription.
 * So none of the plan-side sweeps can ever see it: `finalize-cancelled-subs`
 * selects `billing_subscriptions`, and the add-on's preapproval is not there.
 * Mark the purchase `canceled` without telling MercadoPago and the customer is
 * charged monthly for an add-on the platform no longer believes they own.
 *
 * ## The contract: fail CLOSED, and close the provider FIRST
 *
 * {@link closeAddonPreapproval} is the single gate every add-on cancellation
 * path goes through, and it is deliberately NOT the best-effort contract its own
 * primitive offers. It answers `closed: false` for anything that is not a
 * provider-accepted cancel — a thrown call, and equally an
 * `adapter-unavailable` skip, which for a row that HAS a preapproval means "we
 * did not reach MercadoPago", not "there was nothing to do". Callers must treat
 * `closed: false` as a refusal to proceed: leave the local row exactly as it
 * is, so the purchase stays `active`, stays visible to every retry and sweep
 * that selects on `active`, and stays consistent with a provider that is still
 * charging for it. A stuck-active add-on is recoverable; a terminal row over a
 * live preapproval is the incident.
 *
 * Ordering follows from the same reasoning: close the provider BEFORE the local
 * write, never after. An "after" ordering has a window in which a crash leaves
 * precisely the forbidden state, and no ordering can be recovered by a sweep
 * that the terminal status itself excludes.
 *
 * ## Deliberately NOT behind the recurring-add-ons feature flag
 *
 * `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` gates the CHECKOUT that creates a
 * preapproval. Gating the CLOSE too would build the worst state in the chain:
 * sell a few recurring add-ons, turn the flag back off, and every cancellation
 * silently stops closing preapprovals that are still charging. A preapproval
 * outlives the flag that created it. With the flag off no row carries an
 * `mp_subscription_id`, so this module is a no-op by construction — which is
 * exactly today's behaviour, reached without a branch that can rot.
 *
 * The same argument applies to `HOSPEDA_ADDON_LIFECYCLE_ENABLED`: see
 * `addon-lifecycle-cancellation.service.ts`, where the provider close runs even
 * on the flag-off path.
 *
 * @module services/addon-preapproval-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { apiLogger } from '../utils/logger.js';
import { hardCancelPreapprovalBestEffort } from './billing/preapproval-hard-cancel.js';

/**
 * Which add-on cancellation EVENT asked for the provider close.
 *
 * Enumerated by event rather than by calling function on purpose: the invariant
 * ("no terminal add-on row over a live preapproval") is violated by a PATH, and
 * two different functions can be the same path while one function can serve
 * two. The static guard
 * `test/services/terminal-status-provider-cancel.guard.test.ts` enumerates the
 * same set from the source tree, so a seventh path added later fails CI instead
 * of quietly skipping the close.
 */
export type AddonPreapprovalCancelSource =
    /** The owner cancelled this one add-on: `POST /protected/billing/addons/{id}/cancel`. */
    | 'user-cancel'
    /** Every add-on of a customer revoked at once (account-level action). */
    | 'bulk-customer-revoke'
    /** The customer's PLAN subscription was cancelled (webhook or finalize cron). */
    | 'plan-cancellation'
    /** An admin cancelled the customer's subscription from the admin panel. */
    | 'admin-subscription-cancel'
    /** The purchase reached `expires_at` and is being expired. */
    | 'expiry'
    /** The add-on-expiry cron's orphan sweep found it under a cancelled subscription. */
    | 'orphan-retry'
    /** MercadoPago itself reported the preapproval terminal; we mirror it locally. */
    | 'provider-terminal';

/**
 * The minimum a caller must know about the purchase to close its provider side.
 *
 * Structural rather than the full row so every call site can pass whatever it
 * already selected — several select an explicit column list.
 */
export interface AddonPreapprovalSubject {
    /** `billing_addon_purchases.id`. */
    readonly id: string;
    /** Slug, for log/Sentry correlation only. */
    readonly addonSlug: string;
    /**
     * `billing_addon_purchases.mp_subscription_id`. `null` is the NORMAL case —
     * every one-time add-on, and every recurring purchase sold before the flag
     * was ever turned on — and means there is nothing to close.
     */
    readonly mpSubscriptionId: string | null;
}

/** Input for {@link closeAddonPreapproval}. */
export interface CloseAddonPreapprovalInput {
    /** The purchase whose preapproval must stop charging. */
    readonly purchase: AddonPreapprovalSubject;
    /** Which cancellation event this is. */
    readonly source: AddonPreapprovalCancelSource;
    /**
     * Billing facade. Optional: callers already holding one pass it; the rest
     * fall back to `getQZPayBilling()` inside the primitive.
     */
    readonly billing?: QZPayBilling | null;
}

/**
 * Whether the provider side is now closed, and therefore whether the caller may
 * write a terminal local status.
 *
 * `closed: true` carries WHICH of the two acceptable outcomes it was, so a
 * caller (or a test) can tell "MercadoPago accepted the cancel" from "there was
 * no preapproval in the first place" without re-deriving it from the input.
 */
export type CloseAddonPreapprovalOutcome =
    | { readonly closed: true; readonly kind: 'no-preapproval' | 'cancelled' }
    | { readonly closed: false; readonly reason: string };

/**
 * Close the MercadoPago preapproval behind a recurring add-on purchase, and say
 * whether the caller is now allowed to make the local row terminal.
 *
 * **Never throws** — it reports. Throwing would push every call site into a
 * try/catch whose catch block is the one place a "continue anyway" is easiest to
 * write by accident; a returned verdict has to be read.
 *
 * @param input - The purchase, the cancellation event, and an optional billing facade.
 * @returns `closed: true` when the caller may write the terminal status; `closed: false` when it must not.
 *
 * @example
 * ```ts
 * const close = await closeAddonPreapproval({
 *     purchase, source: 'user-cancel', billing
 * });
 * if (!close.closed) {
 *     return { success: false, error: { code: 'SERVICE_UNAVAILABLE', message: '...' } };
 * }
 * // only now touch billing_addon_purchases
 * ```
 */
export async function closeAddonPreapproval(
    input: CloseAddonPreapprovalInput
): Promise<CloseAddonPreapprovalOutcome> {
    const { purchase, source, billing } = input;

    if (!purchase.mpSubscriptionId) {
        // One-time add-on, or a recurring one whose checkout never reached
        // MercadoPago. Nothing is charging; nothing to close.
        return { closed: true, kind: 'no-preapproval' };
    }

    const outcome = await hardCancelPreapprovalBestEffort({
        subscriptionId: purchase.id,
        mpSubscriptionId: purchase.mpSubscriptionId,
        billing,
        source: 'addon-cancellation',
        extra: {
            addonPurchaseId: purchase.id,
            addonSlug: purchase.addonSlug,
            addonCancelSource: source
        }
    });

    if (outcome.kind === 'cancelled') {
        apiLogger.info(
            {
                addonPurchaseId: purchase.id,
                addonSlug: purchase.addonSlug,
                mpSubscriptionId: purchase.mpSubscriptionId,
                addonCancelSource: source
            },
            'HOS-847: add-on preapproval hard-cancelled at MercadoPago before the local row goes terminal'
        );
        return { closed: true, kind: 'cancelled' };
    }

    const reason =
        outcome.kind === 'failed'
            ? outcome.error
            : `MercadoPago was not reached (${outcome.reason})`;

    apiLogger.error(
        {
            addonPurchaseId: purchase.id,
            addonSlug: purchase.addonSlug,
            mpSubscriptionId: purchase.mpSubscriptionId,
            addonCancelSource: source,
            reason
        },
        'HOS-847: refusing to write a terminal add-on status — its MercadoPago preapproval may still be authorized and charging (HOS-751 shape)',
        // A `failed` outcome was already captured by the primitive with the
        // `addon_hard_cancel_preapproval` tag; capturing again here would
        // double-report the same incident. A `skipped` one was only warned
        // about, and for a row that HAS a preapproval that is just as bad, so
        // this is the capture for it.
        { capture: outcome.kind === 'skipped' }
    );

    return { closed: false, reason };
}
