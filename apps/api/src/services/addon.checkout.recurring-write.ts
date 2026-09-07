/**
 * The two writes a recurring add-on checkout performs, and the one undo
 * (HOS-847 PR 4).
 *
 * Split out of `addon.checkout.recurring.ts` to keep every module in this
 * quartet under the 500-line limit — the limit that is itself the declared
 * reason the recurring branch was extracted from `addon.checkout.ts`. The cut
 * is by responsibility, not by line number: this file is everything the path
 * PERSISTS or UNWINDS, its siblings are the questions it asks
 * (`-resolve.ts`), what it does about a checkout already in flight
 * (`-idempotency.ts`), and the orchestration itself.
 *
 * @module services/addon.checkout.recurring-write
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { AddonDefinition } from '@repo/billing';
import { apiLogger } from '../utils/logger.js';
import {
    RECURRING_ADDON_BILLING_INTERVAL,
    RECURRING_ADDON_PENDING_STATUS
} from './addon.checkout.recurring-resolve.js';

/** Input for {@link insertPendingRecurringPurchase}. */
export interface InsertPendingRecurringPurchaseInput {
    /** Hospeda billing customer id. */
    readonly customerId: string;
    /**
     * The customer's PLAN subscription id — see the comment on the
     * `subscriptionId` column below for why this is never the add-on's own
     * preapproval row.
     */
    readonly planSubscriptionId: string;
    /** The add-on being bought, as resolved from the catalog. */
    readonly addon: AddonDefinition;
    /** MercadoPago preapproval id backing this purchase. */
    readonly mpSubscriptionId: string;
    /** Human-traceable order id. */
    readonly orderId: string;
    /** Buyer's user id. */
    readonly userId: string;
    /** Target accommodation, for a `requiresAccommodationTarget` add-on. */
    readonly accommodationId?: string | undefined;
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
 * @param input - See {@link InsertPendingRecurringPurchaseInput}.
 * @returns The new row's id.
 * @throws Error When the INSERT returns no row.
 */
export async function insertPendingRecurringPurchase(
    input: InsertPendingRecurringPurchaseInput
): Promise<string> {
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
 * Cancel a just-created add-on preapproval without letting the cancellation's
 * own failure mask the original one.
 *
 * Compensating action only — the caller is already on an error path and returns
 * its own error regardless. A failure here is logged loudly because it leaves
 * exactly the state HOS-751 was filed for: a preapproval MercadoPago will keep
 * charging, with nothing local pointing at it.
 *
 * Distinct from the cancel in `addon.checkout.recurring-idempotency.ts`, which
 * is fail-CLOSED: that one is about to open a second checkout, so its failure
 * must abort the attempt. This one runs when the attempt has already failed,
 * where a second failure changes nothing the caller can act on.
 *
 * @param input.billing - Resolved qzpay billing instance.
 * @param input.subscriptionId - The add-on's own local subscription row.
 * @param input.customerId - For the log line only.
 * @param input.addon - For the log line only.
 */
export async function cancelPreapprovalBestEffort(input: {
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
