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
 * - Clears Hospeda's own `cancelAtPeriodEnd` column and writes a
 *   `USER_UNCANCELED` audit event inside a transaction, under a FOR UPDATE
 *   re-read (the authoritative TOCTOU guard against the concurrent
 *   `finalize-cancelled-subs` cron). Clearing the flag removes the row from that
 *   cron's scan (`WHERE cancelAtPeriodEnd = true`) — there is no per-subscription
 *   scheduled job to cancel, so clearing the flag IS cancelling the finalize.
 * - Then calls `billing.subscriptions.uncancel()` (qzpay-core >= 1.17.0), which
 *   re-authorizes the MercadoPago preapproval that the soft-cancel PAUSED
 *   (`PUT status: 'authorized'`) and clears qzpay's own `canceledAt` stamp,
 *   WITHOUT changing `status` (a `trialing` subscription stays `trialing`, its
 *   deferred first charge restored). `canceledAt` is qzpay-core's to own.
 * - Clears the entitlement cache.
 *
 * ### Invariants honoured
 *
 * - **INV-1 (cache invalidation)**: `clearEntitlementCache` runs after the DB
 *   writes so entitlement checks never serve stale data.
 * - **TOCTOU / fail-closed ordering**: the local flag is cleared FIRST inside a
 *   FOR UPDATE transaction (so the finalize cron can neither race the write nor
 *   pick the row up mid-flight), THEN the provider is re-authorized; a provider
 *   failure ROLLS the flag back to `true`, so we never report "kept" while
 *   MercadoPago is still paused. Mirrors softCancelSubscription's flag-first +
 *   rollback structure, reversed.
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
 * the live, pre-finalization states. This matches the `finalize-cancelled-subs`
 * cron's own eligible set (`active`/`trialing`/`past_due`), NOT the narrower
 * soft-cancellable set (`active`/`trialing`): `past_due` is deliberately
 * included because a soft-cancelled subscription can legitimately fall into
 * `past_due` before its period ends, and it is still reversible then. Once the
 * cron flips it to `cancelled`, it is terminal; `paused` is a different axis
 * (reverse with resume), so it is excluded.
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

    // ── Step 4: Clear the local flag FIRST, under a FOR UPDATE re-read ────────
    // Mirrors softCancelSubscription's ordering (reversed). The authoritative
    // TOCTOU guard re-reads the row FOR UPDATE inside the transaction so the
    // concurrent `finalize-cancelled-subs` cron (which flips a due soft-cancel to
    // 'cancelled') is serialized on the row lock: it either committed BEFORE us
    // (we observe a terminal status and abort with the provider untouched) or
    // waits BEHIND our lock (and then sees cancelAtPeriodEnd=false and skips the
    // row). Clearing the flag BEFORE the provider call means the finalize scan
    // (`WHERE cancelAtPeriodEnd = true`) can never pick this row up while the
    // re-authorization is in flight; a provider failure rolls the flag back.
    // `canceledAt` is left to qzpay-core's uncancel (Step 5), which owns it.
    let flagCleared = false;
    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        const [freshRow] = await (tx as typeof db)
            .select({
                status: billingSubscriptions.status,
                cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd
            })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId))
            .for('update');

        if (!freshRow?.cancelAtPeriodEnd) {
            // A concurrent writer already cleared the flag — idempotent, done.
            return;
        }
        if (!UNCANCELLABLE_STATUSES.has(freshRow.status)) {
            // The finalize cron won the race and flipped this to a terminal
            // status. Abort BEFORE touching the provider.
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                `Cannot un-cancel a subscription with status '${freshRow.status}'.`
            );
        }

        await (tx as typeof db)
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        await (tx as typeof db).insert(billingSubscriptionEvents).values({
            subscriptionId,
            eventType: BILLING_EVENT_TYPES.USER_UNCANCELED,
            triggerSource: 'user-uncancel',
            metadata: { preapprovalReauthorized: true }
        });

        flagCleared = true;
    });

    // A concurrent writer already reversed the cancellation — idempotent no-op.
    if (!flagCleared) {
        return { subscriptionId, cancelAtPeriodEnd: false };
    }

    // ── Step 5: Provider call — re-authorize the MP preapproval ──────────────
    // qzpay-core's uncancel re-authorizes the paused preapproval and clears its
    // own canceledAt; it does NOT change status (preserves trialing). On failure
    // we roll the local flag back so we never report "kept" while MercadoPago is
    // still paused (mirrors softCancel's rollback).
    try {
        await billing.subscriptions.uncancel(subscriptionId);
    } catch (error) {
        await db
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId))
            .catch((rollbackErr: unknown) => {
                apiLogger.error(
                    {
                        subscriptionId,
                        customerId,
                        rollbackError:
                            rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr)
                    },
                    'uncancel: failed to roll back cancelAtPeriodEnd after provider error'
                );
            });

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

    // ── Step 6: Clear entitlement cache (INV-1) ──────────────────────────────
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId, customerId },
        'uncancel: completed successfully — subscription kept, preapproval re-authorized'
    );

    // ── Step 7: Return result ─────────────────────────────────────────────────
    return { subscriptionId, cancelAtPeriodEnd: false };
}
