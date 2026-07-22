/**
 * Subscription un-cancel service (HOS-232).
 *
 * Implements `uncancelSubscription` — the reverse of `softCancelSubscription`
 * (SPEC-147). While a soft-cancelled subscription is still inside its access
 * window (`cancelAtPeriodEnd = true`, status still `active`/`trialing`, period
 * NOT yet finalized), the user can change their mind and KEEP the subscription
 * with NO new checkout and NO charge.
 *
 * ### What it does (mirror-image of soft-cancel)
 *
 * - Calls `billing.subscriptions.uncancel()` (qzpay-core >= 1.17.0), which
 *   re-authorizes the MercadoPago preapproval that the soft-cancel PAUSED
 *   (`PUT status: 'authorized'`) and clears qzpay's own `canceledAt` stamp,
 *   WITHOUT changing `status` (a `trialing` subscription stays `trialing`, its
 *   deferred first charge restored).
 * - Clears Hospeda's own `cancelAtPeriodEnd` column (and `canceledAt`), which
 *   also removes the row from the `finalize-cancelled-subs` scan (that cron
 *   selects `WHERE cancelAtPeriodEnd = true` — there is no per-subscription
 *   scheduled job to cancel, so clearing the flag IS cancelling the finalize).
 * - Writes an audit event, clears the entitlement cache, fires a notification.
 *
 * ### Invariants honoured
 *
 * - **INV-1 (cache invalidation)**: `clearEntitlementCache` runs after the DB
 *   writes so entitlement checks never serve stale data.
 * - **Fail-closed provider ordering**: the provider un-pause runs FIRST; the
 *   local flag clear only proceeds if it succeeds, so we never tell the user
 *   "kept" while MercadoPago is still paused (which would silently stop billing).
 *
 * @module services/subscription-uncancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptionEvents, billingSubscriptions, eq, getDb } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { BILLING_EVENT_TYPES, ServiceError, withServiceTransaction } from '@repo/service-core';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../lib/billing-provider-error';
import { captureBillingError } from '../lib/sentry';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/**
 * Input for {@link uncancelSubscription}.
 */
export interface UncancelSubscriptionInput {
    /** The QZPay billing instance from the middleware context. */
    readonly billing: QZPayBilling;
    /** The subscription to un-cancel. */
    readonly subscriptionId: string;
    /** The customer performing the un-cancel (defence-in-depth ownership check). */
    readonly customerId: string;
}

/**
 * Successful result returned by {@link uncancelSubscription}.
 */
export interface UncancelSubscriptionResult {
    /** The subscription that was un-cancelled. */
    readonly subscriptionId: string;
    /** Always `false` — the cleared soft-cancel flag. */
    readonly cancelAtPeriodEnd: false;
}

// ---------------------------------------------------------------------------
// Un-cancellable statuses
// ---------------------------------------------------------------------------

/**
 * Statuses in which a soft-cancelled subscription can still be un-cancelled —
 * the live, pre-finalization states. Mirrors the soft-cancellable set (a
 * subscription that could be soft-cancelled is `active`/`trialing`, and the
 * finalize cron leaves it in one of these until `current_period_end`). Once the
 * `finalize-cancelled-subs` cron flips it to `cancelled`, it is terminal.
 */
const UNCANCELLABLE_STATUSES = new Set(['active', 'trialing', 'past_due']);

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Un-cancels a soft-cancelled subscription: re-authorizes the MercadoPago
 * preapproval via qzpay-core and clears `cancelAtPeriodEnd`/`canceledAt`
 * locally, with NO new checkout and NO charge.
 *
 * **Idempotent**: if `cancelAtPeriodEnd` is already `false` the function returns
 * a success no-op without calling the provider or re-sending the notification.
 *
 * @param input - Un-cancel input (billing, subscriptionId, customerId, etc.)
 * @returns The un-cancel result with subscriptionId and cancelAtPeriodEnd=false.
 * @throws {ServiceError} NOT_FOUND — subscription row not found.
 * @throws {ServiceError} FORBIDDEN — subscription belongs to a different customer.
 * @throws {ServiceError} VALIDATION_ERROR — subscription is not in an un-cancellable state.
 * @throws {ServiceError} PROVIDER_ERROR / PROVIDER_RATE_LIMITED / PROVIDER_TIMEOUT —
 *   qzpay-core threw a QZPayProviderSyncError while re-authorizing the preapproval.
 */
export async function uncancelSubscription(
    input: UncancelSubscriptionInput
): Promise<UncancelSubscriptionResult> {
    const { billing, subscriptionId, customerId } = input;
    const db = getDb();

    // ── Step 1: Initial read — fast-path guards (FOR UPDATE) ─────────────────
    const [existingRow] = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status,
            cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd
        })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscriptionId))
        .for('update');

    if (!existingRow) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            `Subscription '${subscriptionId}' not found.`
        );
    }

    // Defence-in-depth ownership check (route middleware already guards this).
    if (existingRow.customerId !== customerId) {
        apiLogger.warn(
            { subscriptionId, customerId, rowCustomerId: existingRow.customerId },
            'uncancel: ownership mismatch'
        );
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You are not authorized to modify this subscription.'
        );
    }

    // ── Step 2: Idempotency short-circuit ────────────────────────────────────
    // Not soft-cancelled → nothing to reverse. Success no-op.
    if (!existingRow.cancelAtPeriodEnd) {
        apiLogger.info(
            { subscriptionId, customerId },
            'uncancel: cancelAtPeriodEnd already false — idempotent no-op'
        );
        return { subscriptionId, cancelAtPeriodEnd: false };
    }

    // ── Step 3: Status guard ─────────────────────────────────────────────────
    // Only a LIVE soft-cancel (still inside the access window) is reversible.
    if (!UNCANCELLABLE_STATUSES.has(existingRow.status)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `Cannot un-cancel a subscription with status '${existingRow.status}'.`
        );
    }

    // ── Step 4: Provider call FIRST — re-authorize the MP preapproval ────────
    // Fail-closed: if this throws we do NOT clear the local flag, so we never
    // report "kept" while MercadoPago is still paused (which would silently stop
    // billing). qzpay-core's uncancel re-authorizes the paused preapproval and
    // clears its own canceledAt; it does NOT change status (preserves trialing).
    try {
        await billing.subscriptions.uncancel(subscriptionId);
    } catch (error) {
        if (isBillingProviderError(error)) {
            const serviceError = mapProviderErrorToServiceError({
                error,
                operation: 'subscription_uncancel'
            });
            const details = serviceError.details as
                | { providerStatus?: number; operation?: string }
                | undefined;
            captureBillingError(serviceError, {
                operation: 'uncancel',
                providerStatus: details?.providerStatus
            });
            throw serviceError;
        }
        throw error;
    }

    // ── Step 5: Clear the local soft-cancel flag + stamp ─────────────────────
    // Removes the row from the `finalize-cancelled-subs` scan
    // (`WHERE cancelAtPeriodEnd = true`). Status is left untouched — qzpay-core
    // already preserved it, and finalize is scan-based (no scheduled job to
    // cancel). Wrapped in a transaction with the audit event.
    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        await (tx as typeof db)
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: false, canceledAt: null, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        await (tx as typeof db).insert(billingSubscriptionEvents).values({
            subscriptionId,
            eventType: BILLING_EVENT_TYPES.USER_UNCANCELED,
            triggerSource: 'user-uncancel',
            metadata: { preapprovalReauthorized: true }
        });
    });

    // ── Step 6: Clear entitlement cache (INV-1) ──────────────────────────────
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId, customerId },
        'uncancel: completed successfully — subscription kept, preapproval re-authorized'
    );

    // ── Step 7: Return result ─────────────────────────────────────────────────
    return { subscriptionId, cancelAtPeriodEnd: false };
}
