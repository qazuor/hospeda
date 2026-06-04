/**
 * Refund Lifecycle Service
 *
 * Applies the Hospeda-side lifecycle effects when a payment is refunded via
 * the admin panel (T-194-03) or the MP webhook (T-194-04 / T-008). Both
 * callers route through `applyRefundLifecycle` so the policy is defined once.
 *
 * Policy (per SPEC-194 §3 T-194-03):
 * - FULL refund   → transition the linked subscription to `cancelled` via the
 *                   SPEC-194 state machine, insert an audit event, and clear
 *                   the entitlement cache so the customer loses access
 *                   immediately.
 * - PARTIAL refund → keep the subscription active; log a structured
 *                    audit-intent warn.
 *                    TODO(SPEC-194 T-019): model refunded_amount / audit event.
 * - No subscription linked to the payment → log and return (no-op).
 * - Invalid transition (e.g. sub already cancelled) → log + skip the status
 *   write but still clear the cache (idempotent refunds must not error).
 *
 * @module services/refund-lifecycle
 */

import type { QZPayPayment } from '@qazuor/qzpay-core';
import { billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { checkSubscriptionStatusTransition } from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Input for {@link applyRefundLifecycle}.
 */
export interface ApplyRefundLifecycleInput {
    /** The QZPay payment that was refunded. Contains `subscriptionId` and `customerId`. */
    readonly payment: QZPayPayment;
    /**
     * The refund amount in the smallest currency unit (centavos).
     * `undefined` means the refund API was called without an explicit amount,
     * which is treated as a full refund of `payment.amount`.
     */
    readonly refundAmount: number | undefined;
    /** The admin user ID that triggered the refund (for audit trail). */
    readonly adminUserId: string;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Determines whether a refund is a full refund.
 *
 * A refund is full when either:
 * - `refundAmount` is `undefined` (caller did not specify, implies full), or
 * - `refundAmount >= payment.amount`.
 *
 * @param payment - The original payment record.
 * @param refundAmount - The refund amount, or `undefined` for implicit full.
 * @returns `true` when the refund should trigger subscription cancellation.
 */
function isFullRefund(payment: QZPayPayment, refundAmount: number | undefined): boolean {
    if (refundAmount === undefined) {
        return true;
    }
    return refundAmount >= payment.amount;
}

/**
 * Applies Hospeda-side lifecycle effects for a refunded payment.
 *
 * - Full refund: transitions the linked subscription to `cancelled`, inserts
 *   an audit event, and clears the entitlement cache.
 * - Partial refund: logs an audit-intent warning (entitlements unchanged).
 * - No linked subscription: logs and returns without side effects.
 *
 * This function is intentionally fail-safe: individual step failures are
 * caught and logged so a transient DB error does not surface as a 500 on the
 * admin refund endpoint (the core refund has already committed in QZPay).
 *
 * @param input - Payment, refund amount, and admin actor context.
 *
 * @example
 * ```ts
 * // In onAfterPaymentRefund hook (admin tier):
 * await applyRefundLifecycle({ payment, refundAmount: amount, adminUserId: actor.id });
 *
 * // In MP webhook handler (T-008):
 * await applyRefundLifecycle({ payment, refundAmount: undefined, adminUserId: 'webhook' });
 * ```
 */
export async function applyRefundLifecycle({
    payment,
    refundAmount,
    adminUserId
}: ApplyRefundLifecycleInput): Promise<void> {
    const { id: paymentId, customerId, subscriptionId } = payment;

    // ── Guard: payment must be linked to a subscription ────────────────────────
    if (!subscriptionId) {
        apiLogger.info(
            { paymentId, customerId, adminUserId },
            'Refund lifecycle: payment has no linked subscription — no subscription state change'
        );
        return;
    }

    const full = isFullRefund(payment, refundAmount);

    // ── Partial refund: audit-intent only ─────────────────────────────────────
    if (!full) {
        // TODO(SPEC-194 T-019): model refunded_amount and insert a dedicated audit
        // event when partial-refund audit is implemented.
        apiLogger.warn(
            {
                paymentId,
                customerId,
                subscriptionId,
                refundAmount,
                originalAmount: payment.amount,
                adminUserId
            },
            'Refund lifecycle: partial refund — subscription kept active; audit-intent logged (T-019 pending)'
        );
        return;
    }

    // ── Full refund: transition subscription to cancelled ─────────────────────
    apiLogger.info(
        { paymentId, customerId, subscriptionId, refundAmount, adminUserId },
        'Refund lifecycle: full refund — transitioning subscription to cancelled'
    );

    const db = getDb();

    // Look up the current subscription status before writing.
    let currentStatus: string | undefined;
    try {
        const rows = await db
            .select({ status: billingSubscriptions.status })
            .from(billingSubscriptions)
            .where(eq(billingSubscriptions.id, subscriptionId));
        currentStatus = rows[0]?.status;

        if (!currentStatus) {
            apiLogger.warn(
                { subscriptionId, paymentId, customerId, adminUserId },
                'Refund lifecycle: subscription row not found — skipping status transition'
            );
            // Still clear cache: the user should not retain cached entitlements.
            clearEntitlementCache(customerId);
            return;
        }
    } catch (err) {
        apiLogger.error(
            { subscriptionId, paymentId, customerId, err, adminUserId },
            'Refund lifecycle: DB error reading subscription status — clearing cache and aborting transition'
        );
        clearEntitlementCache(customerId);
        return;
    }

    // Guard: validate transition through the SPEC-194 state machine.
    const guard = checkSubscriptionStatusTransition({
        from: currentStatus as `${SubscriptionStatusEnum}`,
        to: SubscriptionStatusEnum.CANCELLED,
        subscriptionId
    });

    if (!guard.valid) {
        apiLogger.warn(
            {
                subscriptionId,
                paymentId,
                customerId,
                from: currentStatus,
                to: SubscriptionStatusEnum.CANCELLED,
                reason: guard.reason,
                adminUserId
            },
            'Refund lifecycle: invalid status transition — skipping status write, still clearing cache'
        );
        // Idempotent: cache clear is always safe even if transition is skipped.
        clearEntitlementCache(customerId);
        return;
    }

    // Write: update subscription status + insert audit event.
    try {
        await db
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.CANCELLED,
                canceledAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        await db.insert(billingSubscriptionEvents).values({
            subscriptionId,
            previousStatus: currentStatus,
            newStatus: SubscriptionStatusEnum.CANCELLED,
            triggerSource: 'admin-refund',
            metadata: {
                paymentId,
                refundAmount: refundAmount ?? payment.amount,
                adminUserId
            }
        });
    } catch (err) {
        apiLogger.error(
            { subscriptionId, paymentId, customerId, err, adminUserId },
            'Refund lifecycle: DB error during status write — clearing cache despite write failure'
        );
    }

    // Always clear cache, even if the DB write failed (fail-open: better to
    // re-load entitlements from QZPay than to leave a stale cancelled-plan user
    // with active entitlements).
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId, paymentId, customerId, adminUserId },
        'Refund lifecycle: subscription cancelled and entitlement cache cleared'
    );
}
