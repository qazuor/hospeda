/**
 * Refund Lifecycle Service
 *
 * Applies the Hospeda-side lifecycle effects when a payment is refunded via
 * the admin panel (T-194-03) or the MP webhook (T-194-04 / T-008). Both
 * callers route through `applyRefundLifecycle` so the policy is defined once.
 *
 * Policy (per SPEC-194 §3 T-194-03 / T-019):
 * - FULL refund   → persist `refunded_amount` on billing_payments (full
 *                   payment.amount), transition the linked subscription to
 *                   `cancelled` via the SPEC-194 state machine, insert an
 *                   audit event, and clear the entitlement cache so the
 *                   customer loses access immediately.
 * - PARTIAL refund → accumulate `refunded_amount` on billing_payments, insert
 *                    a `payment.partial_refund` audit event, keep the
 *                    subscription active (entitlement cache NOT cleared —
 *                    partial refund does not affect entitlements). If the
 *                    accumulated total reaches `payment.amount`, the full
 *                    cancel+revoke path is taken instead.
 * - No subscription linked to the payment → log and return (no-op).
 * - Invalid transition (e.g. sub already cancelled) → log + skip the status
 *   write but still clear the cache (idempotent refunds must not error).
 *
 * ## Unit semantics (CRITICAL — money)
 *
 * All amounts in this service are in **centavos** (integer, smallest ARS unit):
 *   - `payment.amount`   — centavos (stored that way in billing_payments)
 *   - `refundAmount`     — centavos (callers MUST convert before passing)
 *   - `refunded_amount`  — centavos (what this service writes to billing_payments)
 *
 * The webhook caller (`applyWebhookRefundLifecycle` in payment-logic.ts)
 * converts MP's major-unit `transaction_amount_refunded` to centavos before
 * calling this function: `Math.round(mpMajorAmount * 100)`.
 *
 * @module services/refund-lifecycle
 */

import type { QZPayPayment } from '@qazuor/qzpay-core';
import { billingPayments, billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
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
     * The refund amount in **centavos** (smallest currency unit).
     * `undefined` means the refund API was called without an explicit amount,
     * which is treated as a full refund of `payment.amount`.
     *
     * **Callers are responsible for unit conversion.** The webhook caller
     * (`applyWebhookRefundLifecycle` in payment-logic.ts) converts MP's
     * major-unit `transaction_amount_refunded` via `Math.round(amount * 100)`.
     */
    readonly refundAmount: number | undefined;
    /** The admin user ID or source label that triggered the refund (for audit trail). */
    readonly adminUserId: string;
    /**
     * Caller source for audit trail metadata — distinguishes admin panel from
     * webhook and polling paths.
     * @default 'admin'
     */
    readonly source?: 'admin' | 'webhook' | 'polling';
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
 * - Full refund: persists `refunded_amount` on billing_payments (full
 *   payment.amount), transitions the linked subscription to `cancelled`,
 *   inserts an audit event, and clears the entitlement cache.
 * - Partial refund: accumulates `refunded_amount` on billing_payments, inserts
 *   a `payment.partial_refund` audit event, keeps the subscription active (no
 *   entitlement cache clear — partial refunds do not affect entitlements).
 *   When accumulated partials reach `payment.amount`, the full cancel+revoke
 *   path is applied automatically.
 * - No linked subscription: logs and returns without side effects.
 *
 * This function is intentionally fail-safe: individual step failures are
 * caught and logged so a transient DB error does not surface as a 500 on the
 * admin refund endpoint (the core refund has already committed in QZPay).
 *
 * @param input - Payment, refund amount (centavos), actor context, and source.
 *
 * @example
 * ```ts
 * // In onAfterPaymentRefund hook (admin tier):
 * await applyRefundLifecycle({ payment, refundAmount: amount, adminUserId: actor.id, source: 'admin' });
 *
 * // In MP webhook handler (T-008): amount converted major→centavos before call.
 * await applyRefundLifecycle({ payment, refundAmount: centavosAmount, adminUserId: 'webhook', source: 'webhook' });
 * ```
 */
export async function applyRefundLifecycle({
    payment,
    refundAmount,
    adminUserId,
    source = 'admin'
}: ApplyRefundLifecycleInput): Promise<void> {
    const { id: paymentId, customerId, subscriptionId } = payment;

    // ── Guard: payment must be linked to a subscription ────────────────────────
    if (!subscriptionId) {
        apiLogger.info(
            { paymentId, customerId, adminUserId, source },
            'Refund lifecycle: payment has no linked subscription — no subscription state change'
        );
        return;
    }

    const db = getDb();

    // ── Partial refund path ────────────────────────────────────────────────────
    // Read, accumulate, persist refunded_amount; insert partial_refund audit
    // event. When accumulated total reaches payment.amount, fall through to the
    // full-refund cancel path. Entitlement cache is NOT cleared for partial
    // refunds — they do not change subscription status or entitlements.

    const isPartial = !isFullRefund(payment, refundAmount);

    if (isPartial) {
        // The effective partial amount: refundAmount is always defined here
        // because isFullRefund returns false only when refundAmount is defined
        // and < payment.amount.
        const partialAmount = refundAmount as number;

        // Read current accumulated refundedAmount to compute the new total.
        let priorRefundedAmount = 0;
        try {
            const rows = await db
                .select({ refundedAmount: billingPayments.refundedAmount })
                .from(billingPayments)
                .where(eq(billingPayments.id, paymentId));
            priorRefundedAmount = rows[0]?.refundedAmount ?? 0;
        } catch (err) {
            apiLogger.error(
                { paymentId, customerId, subscriptionId, err, adminUserId, source },
                'Refund lifecycle: DB error reading current refunded_amount — using 0 as baseline'
            );
        }

        const newAccumulated = priorRefundedAmount + partialAmount;
        // Cap accumulation at the original payment amount.
        const cappedAccumulated = Math.min(newAccumulated, payment.amount);

        // Check if this partial brings us to a full refund.
        const accumulatedIsFullRefund = cappedAccumulated >= payment.amount;

        if (accumulatedIsFullRefund) {
            apiLogger.info(
                {
                    paymentId,
                    customerId,
                    subscriptionId,
                    partialAmount,
                    priorRefundedAmount,
                    cappedAccumulated,
                    paymentAmount: payment.amount,
                    adminUserId,
                    source
                },
                'Refund lifecycle: accumulated partials reach full refund — taking full cancel path'
            );
            // Fall through to full-refund logic below (update refundedAmount
            // there as well so the column reflects the full amount).
        } else {
            // Pure partial: write refunded_amount and insert audit event only.
            try {
                await db
                    .update(billingPayments)
                    .set({ refundedAmount: cappedAccumulated, updatedAt: new Date() })
                    .where(eq(billingPayments.id, paymentId));

                await db.insert(billingSubscriptionEvents).values({
                    subscriptionId,
                    triggerSource: 'partial-refund',
                    metadata: {
                        action: 'payment.partial_refund',
                        paymentId,
                        partialRefundAmount: partialAmount,
                        priorRefundedAmount,
                        newAccumulatedRefundedAmount: cappedAccumulated,
                        paymentAmount: payment.amount,
                        adminUserId,
                        source
                    }
                });
            } catch (err) {
                apiLogger.error(
                    { paymentId, customerId, subscriptionId, err, adminUserId, source },
                    'Refund lifecycle: DB error persisting partial refund — subscription state unchanged'
                );
            }

            apiLogger.info(
                {
                    paymentId,
                    customerId,
                    subscriptionId,
                    partialRefundAmount: partialAmount,
                    priorRefundedAmount,
                    newAccumulatedRefundedAmount: cappedAccumulated,
                    paymentAmount: payment.amount,
                    adminUserId,
                    source
                },
                'Refund lifecycle: partial refund recorded — subscription kept active'
            );
            return;
        }
    }

    // ── Full refund: transition subscription to cancelled ─────────────────────
    apiLogger.info(
        { paymentId, customerId, subscriptionId, refundAmount, adminUserId, source },
        'Refund lifecycle: full refund — transitioning subscription to cancelled'
    );

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
                { subscriptionId, paymentId, customerId, adminUserId, source },
                'Refund lifecycle: subscription row not found — skipping status transition'
            );
            // Still clear cache: the user should not retain cached entitlements.
            clearEntitlementCache(customerId);
            return;
        }
    } catch (err) {
        apiLogger.error(
            { subscriptionId, paymentId, customerId, err, adminUserId, source },
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
                adminUserId,
                source
            },
            'Refund lifecycle: invalid status transition — skipping status write, still clearing cache'
        );
        // Idempotent: cache clear is always safe even if transition is skipped.
        clearEntitlementCache(customerId);
        return;
    }

    // The effective refunded amount to persist: full payment.amount for a full
    // refund (including accumulated-partials-reaching-full), or the explicit
    // refundAmount if provided.
    const effectiveRefundedAmount = refundAmount !== undefined ? refundAmount : payment.amount;

    // Write: persist refunded_amount, update subscription status, insert audit event.
    try {
        await db
            .update(billingPayments)
            .set({ refundedAmount: effectiveRefundedAmount, updatedAt: new Date() })
            .where(eq(billingPayments.id, paymentId));

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
                action: 'payment.full_refund',
                paymentId,
                refundAmount: effectiveRefundedAmount,
                adminUserId,
                source
            }
        });
    } catch (err) {
        apiLogger.error(
            { subscriptionId, paymentId, customerId, err, adminUserId, source },
            'Refund lifecycle: DB error during status write — clearing cache despite write failure'
        );
    }

    // Always clear cache, even if the DB write failed (fail-open: better to
    // re-load entitlements from QZPay than to leave a stale cancelled-plan user
    // with active entitlements).
    clearEntitlementCache(customerId);

    apiLogger.info(
        { subscriptionId, paymentId, customerId, adminUserId, source },
        'Refund lifecycle: subscription cancelled and entitlement cache cleared'
    );
}
