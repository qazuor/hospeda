/**
 * Promo-code MercadoPago amount-mutation executor (SPEC-262 T-007).
 *
 * This is the **API-side execution seam** for the multi-cycle discount mechanism.
 * `@repo/service-core` DECIDES (`resolveRenewalPromoEffect`) what the MercadoPago
 * preapproval `transaction_amount` should be; this module EXECUTES the mutation
 * against MercadoPago, because service-core must not call MP directly (layer
 * separation, see the spike doc §5 and the SPEC-262 architecture note).
 *
 * Two execution modes, with deliberately different failure semantics (spike §5.6):
 *
 * - **Initial discount apply** (`applyInitialDiscountMutation`) — **FAIL-CLOSED**.
 *   Run BEFORE the first discounted charge, when a `discount` effect with a live
 *   `mp_subscription_id` is applied. If MP rejects the lowered amount, the caller
 *   MUST NOT mark the code applied (else the customer is charged full price under
 *   a "discount"). Returns a typed error.
 *
 * - **Restore-to-full** (`restoreFullPriceMutation`) — **best-effort with retry**.
 *   Run after the last discounted cycle is confirmed. If MP rejects the restore,
 *   the worst case is one extra discounted cycle (recoverable — never a refund),
 *   so we retry a bounded number of times and, on exhaustion, report to Sentry +
 *   log loudly without throwing.
 *
 * It reuses the EXACT mutation call the plan-change flow uses:
 *   `paymentAdapter.subscriptions.update(mpSubscriptionId, { transactionAmount })`
 * (see `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` `confirmPlanUpgrade`
 *  and `apps/api/src/cron/jobs/apply-scheduled-plan-changes.ts`).
 *
 * @module services/promo-renewal-mp.service
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../utils/logger.js';

/**
 * Typed result of a MercadoPago amount-mutation attempt.
 */
export type MpAmountMutationResult =
    | { readonly success: true }
    | {
          readonly success: false;
          readonly error: { readonly code: string; readonly message: string };
      };

/**
 * Number of attempts (1 initial + retries) for the best-effort restore.
 * Kept small — the restore is not on a hot path and a missed restore degrades
 * gracefully (one extra discounted cycle, picked up by the next renewal event).
 */
const RESTORE_MAX_ATTEMPTS = 3;

/**
 * Delay between restore retry attempts, in milliseconds.
 */
const RESTORE_RETRY_DELAY_MS = 500;

/**
 * Apply the INITIAL discount amount to a live MercadoPago preapproval, FAIL-CLOSED.
 *
 * Call this when a `discount` effect (with `durationCycles >= 1` or `null`) is
 * applied to a monthly subscription that has a live `mp_subscription_id`, BEFORE
 * committing the "applied" state. The discounted `transactionAmount` is in MAJOR
 * units (ARS), matching the existing mutation call sites (centavos / 100).
 *
 * Fail-closed contract: if the mutation throws, this returns
 * `{ success: false, error }`. The caller MUST treat that as "code NOT applied"
 * and surface the typed error to the user (spike §5.6, AC — fail-closed apply).
 *
 * @param input.billing - The QZPay billing instance (provides the payment adapter).
 * @param input.mpSubscriptionId - The live MercadoPago preapproval ID.
 * @param input.targetTransactionAmountMajor - Discounted amount in MAJOR units (ARS).
 * @param input.subscriptionId - Local subscription ID (for logging only).
 * @returns Typed success or a typed error (never throws).
 *
 * @example
 * ```ts
 * const r = await applyInitialDiscountMutation({
 *   billing,
 *   mpSubscriptionId: sub.mpSubscriptionId,
 *   targetTransactionAmountMajor: discountedAmount / 100,
 *   subscriptionId: sub.id,
 * });
 * if (!r.success) {
 *   // Do NOT mark the promo code applied. Surface r.error to the caller.
 * }
 * ```
 */
export async function applyInitialDiscountMutation(input: {
    readonly billing: QZPayBilling;
    readonly mpSubscriptionId: string;
    readonly targetTransactionAmountMajor: number;
    readonly subscriptionId: string;
}): Promise<MpAmountMutationResult> {
    const { billing, mpSubscriptionId, targetTransactionAmountMajor, subscriptionId } = input;

    const paymentAdapter = billing.getPaymentAdapter();
    if (!paymentAdapter) {
        const message =
            'Payment adapter unavailable — cannot apply the initial discount amount to MercadoPago';
        apiLogger.error({ subscriptionId, mpSubscriptionId }, message);
        return {
            success: false,
            error: { code: 'MP_ADAPTER_UNAVAILABLE', message }
        };
    }

    try {
        await paymentAdapter.subscriptions.update(mpSubscriptionId, {
            transactionAmount: targetTransactionAmountMajor
        });
        apiLogger.info(
            { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor },
            'Promo discount: applied discounted transaction_amount to MP preapproval'
        );
        return { success: true };
    } catch (mpErr) {
        const message = mpErr instanceof Error ? mpErr.message : String(mpErr);
        // FAIL-CLOSED: the caller must not mark the code applied.
        apiLogger.error(
            { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor, error: message },
            'Promo discount: MP rejected the initial discount amount — failing closed (code NOT applied)'
        );
        return {
            success: false,
            error: {
                code: 'MP_DISCOUNT_APPLY_FAILED',
                message: `MercadoPago rejected the discount amount: ${message}`
            }
        };
    }
}

/**
 * Restore a MercadoPago preapproval's `transaction_amount` to the full plan price
 * after the last discounted cycle, BEST-EFFORT WITH RETRY.
 *
 * Call this when `resolveRenewalPromoEffect` returns `action === 'restore-full'`.
 * The `transactionAmount` is in MAJOR units (ARS). Restoring to the *original*
 * authorized amount is the re-auth-safe direction (spike §3.2 / §5.3).
 *
 * Best-effort contract: this NEVER throws. On all retries failing it captures the
 * error in Sentry and logs at error level, then returns a typed error so the
 * caller can log context. The webhook caller MUST NOT fail the webhook on this —
 * the charge already happened. The SPEC-262 S1 discount-aware reconciler in
 * subscription-poll.job.ts will detect the drift and re-issue the restore mutation
 * on the next cron tick.
 *
 * @param input.billing - The QZPay billing instance.
 * @param input.mpSubscriptionId - The live MercadoPago preapproval ID.
 * @param input.targetTransactionAmountMajor - Full price in MAJOR units (ARS).
 * @param input.subscriptionId - Local subscription ID (for logging / Sentry).
 * @returns Typed success or a typed error (never throws).
 */
export async function restoreFullPriceMutation(input: {
    readonly billing: QZPayBilling;
    readonly mpSubscriptionId: string;
    readonly targetTransactionAmountMajor: number;
    readonly subscriptionId: string;
}): Promise<MpAmountMutationResult> {
    const { billing, mpSubscriptionId, targetTransactionAmountMajor, subscriptionId } = input;

    const paymentAdapter = billing.getPaymentAdapter();
    if (!paymentAdapter) {
        const message =
            'Payment adapter unavailable — cannot restore the full transaction_amount on MercadoPago';
        apiLogger.error({ subscriptionId, mpSubscriptionId }, message);
        Sentry.captureException(new Error(message), {
            extra: { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor },
            tags: { module: 'promo-renewal-mp', operation: 'restoreFullPrice' }
        });
        return {
            success: false,
            error: { code: 'MP_ADAPTER_UNAVAILABLE', message }
        };
    }

    let lastError = '';
    for (let attempt = 1; attempt <= RESTORE_MAX_ATTEMPTS; attempt += 1) {
        try {
            await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                transactionAmount: targetTransactionAmountMajor
            });
            apiLogger.info(
                { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor, attempt },
                'Promo discount: restored full transaction_amount on MP preapproval (discount exhausted)'
            );
            return { success: true };
        } catch (mpErr) {
            lastError = mpErr instanceof Error ? mpErr.message : String(mpErr);
            apiLogger.warn(
                {
                    subscriptionId,
                    mpSubscriptionId,
                    targetTransactionAmountMajor,
                    attempt,
                    maxAttempts: RESTORE_MAX_ATTEMPTS,
                    error: lastError
                },
                'Promo discount: MP restore attempt failed — will retry if attempts remain'
            );
            if (attempt < RESTORE_MAX_ATTEMPTS) {
                await sleep(RESTORE_RETRY_DELAY_MS);
            }
        }
    }

    // All attempts exhausted. Report loudly but do NOT throw — the charge already
    // happened. The SPEC-262 S1 reconciler in subscription-poll.job.ts will detect
    // the amount drift on the next cron tick and re-issue the restore mutation.
    const message = `Failed to restore full transaction_amount after ${RESTORE_MAX_ATTEMPTS} attempts: ${lastError}`;
    apiLogger.error(
        { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor, error: lastError },
        'Promo discount: MP restore exhausted all retries — discount-aware reconciler (SPEC-262 S1) will correct the drift'
    );
    Sentry.captureException(new Error(message), {
        extra: { subscriptionId, mpSubscriptionId, targetTransactionAmountMajor },
        tags: { module: 'promo-renewal-mp', operation: 'restoreFullPrice' }
    });
    return {
        success: false,
        error: { code: 'MP_RESTORE_FAILED', message }
    };
}

/**
 * Promise-based sleep helper for the bounded restore retry loop.
 * @internal
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
