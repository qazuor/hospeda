/**
 * Subscription soft-cancel service (SPEC-147 T-005).
 *
 * Implements `softCancelSubscription` — the user-facing "cancel at period end"
 * flow. The provider (MercadoPago) preapproval is paused automatically inside
 * qzpay-core's `billing.subscriptions.cancel()` since core@1.12.0 (PR #42).
 *
 * ### Invariants honoured
 *
 * - **INV-1 (cache invalidation)**: `clearEntitlementCache` is called
 *   synchronously after the DB writes so entitlement checks never serve
 *   stale data for a soft-cancelled subscription.
 * - **INV-4 (state-machine)**: soft-cancel is a FLAG (`cancelAtPeriodEnd=true`)
 *   on an `active` subscription, NOT a status transition. Status stays `active`
 *   until the finalization cron runs after `current_period_end`.
 *
 * ### Error handling decision (SPEC-147 T-005)
 *
 * Services in this repo use thrown `ServiceError` for operational failures
 * (matching `addon.checkout.ts`, `refund-lifecycle.service.ts`, etc.) rather
 * than a Result-style `{ success, error }` return value. A `QZPayProviderSyncError`
 * from `billing.subscriptions.cancel()` is mapped to a typed `ServiceError` and
 * re-thrown so the route layer's error handler returns the correct HTTP status
 * (502/503/504) to the client. The user explicitly asked to stop being charged;
 * if the provider pause fails, that is a real error that must surface.
 *
 * ### Concurrency guard (FOR UPDATE)
 *
 * The initial SELECT reads the row outside the transaction as a cheap
 * fast-path guard (ownership + status check). Inside the transaction the row
 * is re-read with `SELECT … FOR UPDATE` to serialize concurrent writers
 * (mirror of `subscription-logic.ts:481-485`). Idempotency short-circuits
 * the full path when `cancelAtPeriodEnd` is already `true`.
 *
 * @module services/subscription-cancel
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptionEvents, billingSubscriptions, eq, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { ServiceErrorCode } from '@repo/schemas';
import { BILLING_EVENT_TYPES, ServiceError, withServiceTransaction } from '@repo/service-core';
import {
    isBillingProviderError,
    mapProviderErrorToServiceError
} from '../lib/billing-provider-error';
import { captureBillingError } from '../lib/sentry';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';
import { sendNotification } from '../utils/notification-helper';

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/**
 * Input for {@link softCancelSubscription}.
 *
 * The billing instance is injected so the route layer controls which
 * singleton is used (mirrors the admin-hooks and addon-checkout patterns).
 */
export interface SoftCancelSubscriptionInput {
    /** The QZPay billing instance from the middleware context. */
    readonly billing: QZPayBilling;
    /** The subscription to soft-cancel. */
    readonly subscriptionId: string;
    /**
     * The customer performing the cancel (defence-in-depth ownership check
     * even though the route middleware should already verify this).
     */
    readonly customerId: string;
    /** Optional user-supplied reason stored in the audit event metadata. */
    readonly reason?: string | undefined;
    /** Recipient email for the confirmation notification. */
    readonly recipientEmail?: string | undefined;
    /** Recipient display name for the confirmation notification. */
    readonly recipientName?: string | undefined;
    /** User id for the confirmation notification. */
    readonly userId?: string | null | undefined;
    /** Human-readable plan name for the notification body. */
    readonly planName?: string | undefined;
}

/**
 * Successful result returned by {@link softCancelSubscription}.
 */
export interface SoftCancelSubscriptionResult {
    /** The subscription that was soft-cancelled. */
    readonly subscriptionId: string;
    /** Always `true` — the soft-cancel flag. */
    readonly cancelAtPeriodEnd: true;
    /** The timestamp set by qzpay-core's `cancel()`. */
    readonly canceledAt: Date;
    /**
     * The `current_period_end` of the subscription — the last day the user
     * retains access. Suitable for passing to the confirmation notification.
     */
    readonly accessUntil: Date;
}

// ---------------------------------------------------------------------------
// Soft-cancellable statuses
// ---------------------------------------------------------------------------

/** Statuses that allow a soft-cancel. `trialing` is included: a trialing user
 * should be able to cancel before the trial converts to a paid subscription. */
const SOFT_CANCELLABLE_STATUSES = new Set(['active', 'trialing']);

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Soft-cancels a subscription: sets `cancelAtPeriodEnd=true` locally, pauses
 * the MercadoPago preapproval via qzpay-core, writes an audit event, clears
 * the entitlement cache, and fires a confirmation notification.
 *
 * The subscription status remains `active` — it is flipped to `cancelled` by
 * the finalization cron after `current_period_end` elapses (INV-4).
 *
 * **Idempotent**: if `cancelAtPeriodEnd` is already `true` the function
 * returns a success no-op without calling the provider or re-sending the
 * notification.
 *
 * @param input - Cancel input (billing, subscriptionId, customerId, reason, etc.)
 * @returns The soft-cancel result with subscriptionId, cancelAtPeriodEnd,
 *   canceledAt and accessUntil fields.
 * @throws {ServiceError} AUTHORIZATION_ERROR — sub belongs to a different customer.
 * @throws {ServiceError} NOT_FOUND — subscription row not found.
 * @throws {ServiceError} VALIDATION_ERROR — subscription is not in a cancellable state.
 * @throws {ServiceError} PROVIDER_ERROR / PROVIDER_RATE_LIMITED / PROVIDER_TIMEOUT —
 *   qzpay-core threw a QZPayProviderSyncError while pausing the MP preapproval.
 */
export async function softCancelSubscription(
    input: SoftCancelSubscriptionInput
): Promise<SoftCancelSubscriptionResult> {
    const { billing, subscriptionId, customerId, reason } = input;
    const db = getDb();

    // ── Step 1: Initial read — fast-path guards ──────────────────────────────
    // Read outside the transaction so we can abort cheaply before acquiring a
    // row lock. The authoritative TOCTOU guard runs inside the tx (Step 4).
    const [existingRow] = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status,
            cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
            canceledAt: billingSubscriptions.canceledAt,
            currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
            planId: billingSubscriptions.planId
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
            'soft-cancel: ownership mismatch'
        );
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'You are not authorized to cancel this subscription.'
        );
    }

    // ── Step 2: Idempotency short-circuit ────────────────────────────────────
    // Already soft-cancelled → return success no-op. No provider call, no
    // duplicate notification, no duplicate event.
    if (existingRow.cancelAtPeriodEnd) {
        apiLogger.info(
            { subscriptionId, customerId },
            'soft-cancel: already cancelAtPeriodEnd=true — idempotent no-op'
        );
        return {
            subscriptionId,
            cancelAtPeriodEnd: true,
            canceledAt: existingRow.canceledAt ?? new Date(),
            accessUntil: existingRow.currentPeriodEnd
        };
    }

    // ── Step 3: Status guard ─────────────────────────────────────────────────
    if (!SOFT_CANCELLABLE_STATUSES.has(existingRow.status)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `Cannot soft-cancel a subscription with status '${existingRow.status}'.`
        );
    }

    // ── Step 4: Write cancelAtPeriodEnd=true BEFORE the provider call ──────────
    // SPEC-147 T-007 ordering fix: the webhook collision guard in subscription-logic.ts
    // reads cancelAtPeriodEnd under a FOR UPDATE lock. For the guard to fire reliably,
    // the flag must be committed BEFORE MercadoPago fires the paused webhook.
    //
    // Writing first eliminates the race window that existed when the DB write was
    // after the provider call:  (old) provider pause → [race window] → flag written.
    // With this ordering:       flag written → provider pause → webhook sees flag=true.
    //
    // If the provider call fails after the flag is written, the flag is rolled back
    // by the cleanup below so billing remains consistent (the preapproval was NOT
    // paused, so future billing cycles must still charge the user).
    let flagWritten = false;
    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        // TOCTOU guard: re-read with FOR UPDATE inside the transaction so
        // concurrent webhook writes are serialized. Mirrors subscription-logic.ts:481-485.
        const [freshRow] = await (tx as typeof db)
            .select({ cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId))
            .for('update');

        if (freshRow?.cancelAtPeriodEnd) {
            // A concurrent writer already applied the soft-cancel — skip writes.
            apiLogger.debug(
                { subscriptionId },
                'soft-cancel tx: cancelAtPeriodEnd already true under FOR UPDATE — skipping write'
            );
            return;
        }

        // Write cancelAtPeriodEnd=true + updatedAt. Status stays unchanged.
        await (tx as typeof db)
            .update(billingSubscriptions)
            .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // Write USER_CANCELED audit event.
        await (tx as typeof db).insert(billingSubscriptionEvents).values({
            subscriptionId,
            eventType: BILLING_EVENT_TYPES.USER_CANCELED,
            triggerSource: 'user-cancel',
            metadata: {
                reason: reason ?? null,
                preapprovalPaused: true
            }
        });

        flagWritten = true;
    });

    // ── Step 5: Provider call — pause MP preapproval ─────────────────────────
    // billing.subscriptions.cancel() with cancelAtPeriodEnd:true now calls
    // paymentAdapter.subscriptions.cancel(providerSubscriptionId, true) which
    // in the MP adapter maps to preapproval status:'paused' (qzpay PR #42).
    // canceledAt is set by qzpay-core; cancelAtPeriodEnd is NOT (realign #3).
    let canceledAt: Date;
    try {
        const cancelResult = await billing.subscriptions.cancel(subscriptionId, {
            cancelAtPeriodEnd: true,
            reason
        });
        // The result has canceledAt set by qzpay-core.
        canceledAt = (cancelResult as { canceledAt?: Date }).canceledAt ?? new Date();
    } catch (error) {
        // SPEC-149 provider error handling: map QZPayProviderSyncError to typed
        // ServiceError so the route handler returns the correct HTTP status.
        // We do NOT swallow this — the user asked to stop being charged; if the
        // provider pause fails that is a real, surfaceable failure.
        //
        // Roll back cancelAtPeriodEnd=true so billing stays consistent.
        // The preapproval was NOT paused, so future billing cycles must still charge.
        if (flagWritten) {
            await db
                .update(billingSubscriptions)
                .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
                .where(eq(billingSubscriptions.id, subscriptionId))
                .catch((rollbackErr: unknown) => {
                    apiLogger.error(
                        {
                            subscriptionId,
                            customerId,
                            rollbackError:
                                rollbackErr instanceof Error
                                    ? rollbackErr.message
                                    : String(rollbackErr)
                        },
                        'soft-cancel: failed to roll back cancelAtPeriodEnd flag after provider error'
                    );
                });
        }
        if (isBillingProviderError(error)) {
            const serviceError = mapProviderErrorToServiceError({
                error,
                operation: 'subscription_cancel'
            });
            const details = serviceError.details as
                | { providerStatus?: number; operation?: string }
                | undefined;
            captureBillingError(serviceError, {
                operation: 'soft_cancel',
                providerStatus: details?.providerStatus
            });
            throw serviceError;
        }
        throw error;
    }

    // ── Step 6: Clear entitlement cache (INV-1) ──────────────────────────────
    // Must run after DB writes commit so re-computed entitlements reflect the
    // new cancelAtPeriodEnd flag. Runs outside the transaction (non-rollback-able).
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId, customerId, reason, accessUntil: existingRow.currentPeriodEnd },
        'soft-cancel: completed successfully'
    );

    // ── Step 7: Queue confirmation notification (fire-and-forget) ────────────
    // SPEC-167 lesson: wrap in Promise.resolve() so a synchronous undefined
    // return from the cleared-mock does not cause a sync TypeError. The catch
    // is intentionally swallowed — notification failure must not fail the cancel.
    if (input.recipientEmail && input.recipientName) {
        void Promise.resolve(
            sendNotification({
                type: NotificationType.SUBSCRIPTION_CANCEL_CONFIRMED,
                recipientEmail: input.recipientEmail,
                recipientName: input.recipientName,
                userId: input.userId ?? null,
                customerId,
                planName: input.planName ?? '',
                accessUntil: existingRow.currentPeriodEnd.toISOString()
            })
        ).catch((err: unknown) => {
            apiLogger.warn(
                {
                    subscriptionId,
                    customerId,
                    error: err instanceof Error ? err.message : String(err)
                },
                'soft-cancel: confirmation notification failed (non-blocking)'
            );
        });
    }

    // ── Step 8: Return result ─────────────────────────────────────────────────
    return {
        subscriptionId,
        cancelAtPeriodEnd: true,
        canceledAt,
        accessUntil: existingRow.currentPeriodEnd
    };
}
