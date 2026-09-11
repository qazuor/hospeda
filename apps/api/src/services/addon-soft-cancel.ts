/**
 * Cancelling a RECURRING add-on at the end of the period the customer already
 * paid for (HOS-847 PR 6 — owner decision).
 *
 * ## Two things happen at different times, and that is the point
 *
 * - **Charging stops now.** The MercadoPago preapproval is hard-cancelled by the
 *   caller before this function runs, and fails closed — nothing here is written
 *   unless the provider confirmed it will not charge again.
 * - **The benefit stops at `current_period_end`.** The customer paid for that
 *   period; taking it away the same day is a refund question nobody wants to
 *   answer. So the row stays `status = 'active'` and only gains
 *   `cancel_at_period_end = true`. The QZPay entitlement and limit are left
 *   exactly as they are — `loadEntitlements` keeps granting them, which is the
 *   intended outcome, not an oversight.
 *
 * This mirrors the soft-cancel grace the plan-side already has (see
 * `docs/billing/grace-period-source-of-truth.md`), which is why the wording is
 * "until the end of the current period" in both places.
 *
 * ## What finishes the job
 *
 * The `addon-expiry` cron. `findExpiredAddons` selects a row when either its
 * `expires_at` has passed OR it is a soft-cancelled recurring row whose
 * `current_period_end` has passed, and `expireAddon` then does the real
 * revocation. A soft-cancelled row therefore has exactly ONE thing standing
 * between it and a free benefit forever: that cron.
 *
 * @remarks
 * **Obligation for PR 7's reconciler**: it must sweep `active` rows carrying
 * `cancel_at_period_end = true` whose `current_period_end` is in the past. One
 * of those is a benefit nobody is paying for — the preapproval is already
 * cancelled at MercadoPago, so no charge will ever arrive to correct it, and no
 * other sweep looks at that pair. A missed cron tick is recoverable; a cron that
 * silently stopped picking these up is invisible without that reconciler.
 *
 * ## NOT the same as the inbound revocation
 *
 * When MercadoPago reports the preapproval terminal on its own
 * (`addon-recurring-revoke.service.ts`), there is no paid period left to
 * respect — the buyer killed the subscription at the provider — and the grants
 * are revoked immediately. Opposite handling of two events that both read as
 * "cancelled" in a log line.
 *
 * @module services/addon-soft-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { DrizzleClient } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import type { ServiceResult } from '@repo/service-core';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';
import { resolveRecipientLocale } from './notification-recipient-locale';

/** Input for {@link softCancelRecurringAddon}. */
export interface SoftCancelRecurringAddonInput {
    /** `billing_addon_purchases.id`. */
    readonly purchaseId: string;
    /** QZPay billing customer id. */
    readonly customerId: string;
    /** Add-on slug, for logs and the notification's deep link. */
    readonly addonSlug: string;
    /** Display name from the catalog, falling back to the slug. */
    readonly addonName: string;
    /**
     * End of the period the customer already paid for — when the benefit
     * actually stops. Non-nullable on purpose: a caller that cannot supply it
     * must refuse the cancellation rather than call this with a guess.
     */
    readonly currentPeriodEnd: Date;
    /** Optional free-text reason from the request body. */
    readonly reason?: string;
    /** The acting user, for the notification's locale and deep link. */
    readonly userId?: string | null;
    /** Billing facade, used only to look the customer up for the email. */
    readonly billing: QZPayBilling;
    /** Drizzle client (the caller's transaction when it holds one). */
    readonly db: DrizzleClient;
}

/**
 * Mark a recurring add-on to stop at the end of its paid period.
 *
 * **Writes nothing terminal.** The row keeps `status = 'active'`; only
 * `cancel_at_period_end` flips. That is what leaves the benefit granted, and it
 * is also why the HOS-847 terminal-write guard does not (and should not) list
 * this file: there is no terminal status here to pair with a provider close, and
 * the close already happened in the caller.
 *
 * **Idempotent in EFFECT, not in the row filter.** The UPDATE deliberately keeps
 * `status = 'active'`, so a second call matches the same row again and writes the
 * same `cancel_at_period_end = true` — it does not "find no `active` row", which
 * is what this doc used to claim and what the `status` filter would do if this
 * function wrote a terminal status like every other cancellation path. What makes
 * the repeat harmless is that the write is idempotent, and what makes it QUIET is
 * the `rowCount` gate below: the cancellation email is dispatched only for an
 * UPDATE that actually moved a row.
 *
 * That gate is a floor, not a guarantee. The caller inside
 * `finalize-cancelled-subs.ts` runs this with `db = tx`, and a LATER add-on
 * failing in the same transaction rolls the flag back while leaving the email
 * sent and the MercadoPago preapproval closed. The next run then finds the row
 * `active` and unflagged, updates it again, and mails again. Fixing that means
 * deferring notifications until after the transaction commits, which is a change
 * to `handleSubscriptionCancellationAddons`'s contract (it would have to return
 * the pending sends) and is deliberately out of this PR's scope. What the gate
 * removes is the unconditional duplicate — the one that fired even when nothing
 * had changed.
 *
 * @param input - Purchase, customer, the period end, and the billing/db handles.
 * @returns Success once the flag is persisted; an error only if the UPDATE failed.
 *
 * @example
 * ```ts
 * // AFTER the preapproval has been hard-cancelled and confirmed:
 * await softCancelRecurringAddon({
 *     purchaseId, customerId, addonSlug, currentPeriodEnd, billing, db
 * });
 * ```
 */
export async function softCancelRecurringAddon(
    input: SoftCancelRecurringAddonInput
): Promise<ServiceResult<void>> {
    const { purchaseId, customerId, addonSlug, currentPeriodEnd, reason, db } = input;

    const { billingAddonPurchases } = await import('@repo/db/schemas/billing');
    const { and, eq, isNull } = await import('drizzle-orm');

    /**
     * Whether the UPDATE actually changed a row. Gates the cancellation email:
     * a repeat call re-writes the same flag onto the same still-`active` row and
     * must not mail the customer a second time.
     */
    let movedARow = false;

    try {
        const updateResult = await db
            .update(billingAddonPurchases)
            .set({
                cancelAtPeriodEnd: true,
                updatedAt: new Date()
            })
            .where(
                and(
                    eq(billingAddonPurchases.id, purchaseId),
                    // `canceledAt` is deliberately NOT set: every other reader in
                    // the codebase treats it as the companion of
                    // `status = 'canceled'`, and writing it onto an `active` row
                    // would make a soft-cancelled add-on read as revoked in
                    // exactly the places that decide whether it still counts.
                    eq(billingAddonPurchases.status, 'active'),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        const rowCount = (updateResult as { rowCount?: number }).rowCount ?? 0;

        if (rowCount === 0) {
            apiLogger.warn(
                { customerId, addonSlug, purchaseId, reason },
                'Add-on soft-cancel affected 0 rows — it was likely cancelled concurrently; treating as already cancelled'
            );
        } else {
            movedARow = true;
            apiLogger.info(
                {
                    customerId,
                    addonSlug,
                    purchaseId,
                    reason,
                    accessUntil: currentPeriodEnd.toISOString()
                },
                'HOS-847: recurring add-on will not renew — MercadoPago closed, benefit kept until the end of the paid period'
            );
        }
    } catch (dbError) {
        apiLogger.error(
            {
                error: dbError instanceof Error ? dbError.message : String(dbError),
                customerId,
                addonSlug,
                purchaseId
            },
            'HOS-847: failed to flag a recurring add-on as cancel-at-period-end — its MercadoPago preapproval is ALREADY cancelled, so this row will keep granting a benefit nobody is paying for until it is repaired',
            { capture: true }
        );

        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to schedule the add-on cancellation'
            }
        };
    }

    // Only for an UPDATE that moved a row. A repeat call — a MercadoPago
    // redelivery, a cron retry after a partial failure, the orphan sweep meeting
    // a row the webhook already flagged — writes the same flag onto the same
    // `active` row and must not mail the customer again. Nothing else here reads
    // `rowCount`, so this is the whole of the de-duplication.
    if (movedARow) {
        await notifySoftCancellation(input);
    }

    return { success: true, data: undefined };
}

/**
 * Fire-and-forget cancellation email.
 *
 * Uses `ADDON_CANCELLATION` with BOTH dates. `canceledAt` is "when the add-on
 * was cancelled", which is now — the cancellation WAS accepted now, and only
 * its effect is deferred. `accessUntil` is when the effect lands, and it is the
 * only reason this path differs from an immediate cancellation in the
 * customer's inbox.
 *
 * HOS-847 PR 7c added the field AND the template branch that renders it, in one
 * change on purpose: the earlier note here recorded why shipping the payload
 * field alone was refused — it renders nothing and looks done.
 *
 * This is the ONLY sender that supplies the field. The immediate path in
 * `addon.user-addons.ts` deliberately omits it, because it has already removed
 * the entitlements by the time it mails, so a promise of continued access there
 * would be false.
 *
 * @param input - The same input {@link softCancelRecurringAddon} received.
 */
async function notifySoftCancellation(input: SoftCancelRecurringAddonInput): Promise<void> {
    const { customerId, addonSlug, addonName, billing, currentPeriodEnd } = input;
    const userId = input.userId ?? null;

    try {
        const customer = await billing.customers.get(customerId);
        if (!customer) {
            return;
        }

        const customerName =
            typeof customer.metadata?.name === 'string'
                ? customer.metadata.name
                : (customer.email ?? 'Usuario');
        const recipientLocale = await resolveRecipientLocale({ userId });

        sendNotification({
            type: NotificationType.ADDON_CANCELLATION,
            recipientEmail: customer.email,
            recipientName: customerName,
            userId,
            customerId,
            addonName,
            canceledAt: new Date().toISOString(),
            addonSlug,
            locale: recipientLocale,
            // Non-nullable on the input by construction — a caller that cannot
            // supply it must refuse the cancellation rather than guess — so the
            // email can state the date instead of hedging.
            accessUntil: currentPeriodEnd.toISOString()
        }).catch((notifErr) => {
            apiLogger.debug(
                {
                    customerId,
                    addonSlug,
                    error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                },
                'ADDON_CANCELLATION notification failed (non-blocking)'
            );
        });
    } catch (lookupErr) {
        apiLogger.debug(
            {
                customerId,
                addonSlug,
                error: lookupErr instanceof Error ? lookupErr.message : String(lookupErr)
            },
            'Could not look up customer for ADDON_CANCELLATION notification, skipping'
        );
    }
}
