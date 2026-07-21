/**
 * Immediate paid plan swap — mutate-preapproval + local changePlan, NO charge
 * (HOS-222).
 *
 * ## Why this exists
 *
 * A cross-category rank-UP plan change (e.g. `tourist-vip` → `owner-basico`)
 * is a genuine UPGRADE even when the target plan is the SAME price or CHEAPER,
 * because it moves the customer to a higher product tier. The price-based
 * classifier in `plan-change.ts` cannot see that, so such a change used to fall
 * into the downgrade branch and be rejected (`NOT_A_DOWNGRADE`, HTTP 422).
 *
 * The owner decision (HOS-222) is to force these changes onto the IMMEDIATE
 * path. For an ACTIVE (non-trial) subscription where the target is equal or
 * cheaper there is NO prorated delta to charge — `initiatePaidPlanUpgrade`
 * (which charges the positive delta) does not apply and would throw
 * `NOT_AN_UPGRADE`. This module is that missing branch: it swaps the plan
 * immediately with no charge and no proration credit.
 *
 * ## Mechanism
 *
 * Same primitive as `trialing-plan-upgrade.service.ts` and
 * `payment-logic.ts`'s `confirmPlanUpgrade`:
 *   `paymentAdapter.subscriptions.update(mpSubscriptionId, { planId, transactionAmount, reason })`
 * mutates the live preapproval to the new plan + amount, then
 * `billing.subscriptions.changePlan(..., { prorationBehavior: 'none', applyAt:
 * 'immediately' })` commits the plan locally. `reason` is the target plan's
 * display name (via `resolvePlanChangeReason`) so the buyer sees a human label
 * rather than the raw plan UUID — mirroring the two existing MP update sites.
 *
 * ## Fail-closed contract (critical, mirrors the trialing flow)
 *
 * The MP mutation runs BEFORE the local `changePlan`, and both halves fail
 * distinctly:
 *
 * - **MP mutation fails** (no live preapproval, no payment adapter, or MP
 *   rejects): throws `SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED')`.
 *   Nothing was mutated — safe, retryable, maps to HTTP 502.
 * - **MP mutation SUCCEEDS but the local `changePlan` commit throws**: throws
 *   `SubscriptionCheckoutError('IMMEDIATE_SWAP_LOCAL_APPLY_FAILED')` — a genuine
 *   local/MP drift state (MP already carries the new plan/amount while the local
 *   row still shows the old plan), paged via `apiLogger.error(..., { capture:
 *   true })`. Maps to HTTP 500.
 *
 * The best-effort post-apply steps (entitlement cache, restoration, featured
 * sync, addon recalc, pending-downgrade clear) stay soft-fail — identical to
 * the trialing flow.
 *
 * @module services/billing/immediate-plan-swap
 */

import type { QZPayBilling, QZPayChangePlanResult } from '@qazuor/qzpay-core';
import { type DrizzleClient, getDb } from '@repo/db';
import {
    resolveOwnerPlanGrantsFeatured,
    syncFeaturedByEntitlementForOwner
} from '@repo/service-core';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { apiLogger } from '../../utils/logger.js';
import { handlePlanChangeAddonRecalculation } from '../addon-plan-change.service.js';
import { applyUpgradeRestorationsOrWarn } from '../plan-upgrade-restoration.service.js';
import { clearPendingScheduledPlanChange } from '../subscription-downgrade.service.js';
import { resolveOwnerUserId } from '../subscription-pause.service.js';
import { resolvePlanChangeReason } from './plan-change-reason.js';
import { SubscriptionCheckoutError } from './subscription-checkout-error.js';

/**
 * Input for {@link applyImmediatePaidPlanSwap}.
 *
 * The caller (the immediate rank-UP branch of `handlePlanChange`) already
 * resolved all of these from its own subscription/plan/price lookups.
 */
export interface ApplyImmediatePaidPlanSwapInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Local subscription id being swapped (must currently be `active`). */
    readonly subscriptionId: string;
    /** Plan the subscription is currently on. */
    readonly oldPlanId: string;
    /** Plan the subscription is moving to (equal-or-cheaper, higher tier). */
    readonly newPlanId: string;
    /** Target plan's price id for the subscription's billing interval. */
    readonly newPriceId: string;
    /**
     * Target plan's price, in MAJOR units (ARS) — the unit
     * `paymentAdapter.subscriptions.update`'s `transactionAmount` expects.
     */
    readonly targetTransactionAmountMajor: number;
    /**
     * The live MercadoPago preapproval id for this subscription
     * (`providerSubscriptionIds.mercadopago`). Required — an active
     * subscription with no live preapproval cannot be mutated, so its absence
     * is a fail-closed condition.
     */
    readonly mpSubscriptionId: string | undefined;
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
}

/** Result of a successful {@link applyImmediatePaidPlanSwap} call. */
export interface ApplyImmediatePaidPlanSwapResult {
    readonly subscriptionId: string;
    readonly previousPlanId: string;
    readonly newPlanId: string;
}

/**
 * Apply an immediate paid plan swap to an ACTIVE subscription with NO charge
 * and NO proration (HOS-222).
 *
 * Steps, in order:
 *   1. Mutate the MP preapproval's `planId` + `transaction_amount` (+ display
 *      `reason`). FAIL-CLOSED: any failure (missing preapproval id, missing
 *      payment adapter, or MP rejecting) throws
 *      `SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED')` and applies
 *      NOTHING locally.
 *   2. Commit the plan change locally via `billing.subscriptions.changePlan`
 *      with `prorationBehavior: 'none'` and `applyAt: 'immediately'`. FAIL-LOUD:
 *      if this throws AFTER step 1 succeeded, throws
 *      `SubscriptionCheckoutError('IMMEDIATE_SWAP_LOCAL_APPLY_FAILED')` and pages
 *      Sentry via `apiLogger.error(..., { capture: true })`.
 *   3. Invalidate the entitlement cache, restore plan-restricted resources,
 *      sync `featuredByEntitlement`, recalculate addon limits, and clear any
 *      pending scheduled downgrade — all best-effort.
 *
 * @throws SubscriptionCheckoutError code `MP_PREAPPROVAL_MUTATION_FAILED` when
 *   the MP mutation cannot be applied — nothing mutated locally.
 * @throws SubscriptionCheckoutError code `IMMEDIATE_SWAP_LOCAL_APPLY_FAILED`
 *   when the MP mutation succeeded but the local commit failed — a drift state.
 */
export async function applyImmediatePaidPlanSwap(
    input: ApplyImmediatePaidPlanSwapInput
): Promise<ApplyImmediatePaidPlanSwapResult> {
    const {
        billing,
        subscriptionId,
        oldPlanId,
        newPlanId,
        newPriceId,
        targetTransactionAmountMajor,
        mpSubscriptionId,
        db
    } = input;

    // Step 1: mutate the MP preapproval FIRST, fail-closed.
    if (!mpSubscriptionId) {
        const message =
            'Active subscription has no linked MercadoPago preapproval — cannot apply the plan swap without a live preapproval to mutate';
        apiLogger.error({ subscriptionId, oldPlanId, newPlanId }, message);
        throw new SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED', message);
    }

    const paymentAdapter = billing.getPaymentAdapter();
    if (!paymentAdapter) {
        const message =
            'Payment adapter unavailable — cannot apply the new plan price to the MercadoPago preapproval';
        apiLogger.error({ subscriptionId, mpSubscriptionId }, message);
        throw new SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED', message);
    }

    // HOS-220: pass the plan display name as the MP preapproval `reason` so the
    // buyer sees e.g. "Basic" instead of the raw plan UUID; `undefined` keeps
    // the adapter's synthetic fallback. Resolved before the MP call so a
    // best-effort name lookup never runs mid-mutation.
    const reason = await resolvePlanChangeReason({ planId: newPlanId });

    try {
        await paymentAdapter.subscriptions.update(mpSubscriptionId, {
            // Cross-plan mutation — planId is REQUIRED, mirroring the existing
            // cross-plan precedents (confirmPlanUpgrade, apply-scheduled-plan-changes,
            // trialing-plan-upgrade).
            planId: newPlanId,
            transactionAmount: targetTransactionAmountMajor,
            reason
        });
    } catch (mpErr) {
        const rawMessage = mpErr instanceof Error ? mpErr.message : String(mpErr);
        apiLogger.error(
            {
                subscriptionId,
                mpSubscriptionId,
                oldPlanId,
                newPlanId,
                targetTransactionAmountMajor,
                error: rawMessage
            },
            'Immediate plan swap: MP rejected the new plan amount — failing closed (plan NOT changed)'
        );
        throw new SubscriptionCheckoutError(
            'MP_PREAPPROVAL_MUTATION_FAILED',
            `MercadoPago rejected the new plan amount: ${rawMessage}`
        );
    }

    apiLogger.info(
        {
            subscriptionId,
            mpSubscriptionId,
            oldPlanId,
            newPlanId,
            targetTransactionAmountMajor
        },
        'Immediate plan swap: applied new plan amount to MP preapproval, no charge'
    );

    // Step 2: commit the local plan change — only after the MP mutation
    // succeeded. No proration: this is a lateral/cheaper cross-tier swap, so
    // there is no delta to charge and no credit to issue.
    //
    // FAIL-LOUD: if this throws, MP has ALREADY been mutated to the new
    // plan/amount above — a genuine local/MP drift state. Page loudly via
    // `{ capture: true }` rather than surfacing a generic 500.
    let changeResult: QZPayChangePlanResult;
    try {
        changeResult = await billing.subscriptions.changePlan(subscriptionId, {
            newPlanId,
            newPriceId,
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
    } catch (changePlanErr) {
        const rawMessage =
            changePlanErr instanceof Error ? changePlanErr.message : String(changePlanErr);
        apiLogger.error(
            {
                subscriptionId,
                mpSubscriptionId,
                oldPlanId,
                newPlanId,
                targetTransactionAmountMajor,
                error: rawMessage
            },
            'Immediate plan swap: MP preapproval already mutated to the new plan but local plan change failed — manual reconcile required',
            { capture: true }
        );
        throw new SubscriptionCheckoutError(
            'IMMEDIATE_SWAP_LOCAL_APPLY_FAILED',
            `MercadoPago was already updated to the new plan, but the local plan change failed — manual reconcile required: ${rawMessage}`
        );
    }

    // INV-1: invalidate the entitlement middleware cache for this customer.
    clearEntitlementCache(changeResult.subscription.customerId);

    // Step 3a: restore plan-restricted resources + sync featuredByEntitlement.
    // Soft-fail — mirrors confirmPlanUpgrade / applyTrialingPlanUpgrade exactly.
    try {
        const userId = await resolveOwnerUserId({
            customerId: changeResult.subscription.customerId,
            ...(db ? { db } : {})
        });
        if (userId) {
            await applyUpgradeRestorationsOrWarn({
                userId,
                customerId: changeResult.subscription.customerId,
                newPlanId
            });
            try {
                const swappedPlanHasFeatured = await resolveOwnerPlanGrantsFeatured({
                    ownerId: userId
                });
                await syncFeaturedByEntitlementForOwner({
                    ownerId: userId,
                    active: swappedPlanHasFeatured
                });
                apiLogger.info(
                    {
                        subscriptionId,
                        newPlanId,
                        active: swappedPlanHasFeatured,
                        customerId: changeResult.subscription.customerId
                    },
                    'Immediate plan swap: featuredByEntitlement synced'
                );
            } catch (featuredSyncErr) {
                apiLogger.warn(
                    {
                        subscriptionId,
                        newPlanId,
                        customerId: changeResult.subscription.customerId,
                        error:
                            featuredSyncErr instanceof Error
                                ? featuredSyncErr.message
                                : String(featuredSyncErr)
                    },
                    'Immediate plan swap: syncFeaturedByEntitlementForOwner failed (non-blocking)'
                );
            }
        } else {
            apiLogger.warn(
                { subscriptionId, newPlanId, customerId: changeResult.subscription.customerId },
                'Immediate plan swap: could not resolve owner userId for upgrade restoration — skipped'
            );
        }
    } catch (restorationErr) {
        apiLogger.warn(
            {
                subscriptionId,
                newPlanId,
                customerId: changeResult.subscription.customerId,
                error:
                    restorationErr instanceof Error
                        ? restorationErr.message
                        : String(restorationErr)
            },
            'Immediate plan swap: upgrade restoration step threw unexpectedly — plan change committed, manual restoration may be needed'
        );
    }

    // Step 3b: refresh addon limits — best-effort.
    try {
        await handlePlanChangeAddonRecalculation({
            customerId: changeResult.subscription.customerId,
            oldPlanId,
            newPlanId,
            billing,
            db: db ?? getDb()
        });
    } catch (recalcErr) {
        apiLogger.error(
            {
                subscriptionId,
                newPlanId,
                error: recalcErr instanceof Error ? recalcErr.message : String(recalcErr)
            },
            'Immediate plan swap: addon recalculation failed — non-blocking'
        );
    }

    // Step 3c: race-condition cleanup — clear any queued downgrade.
    try {
        await clearPendingScheduledPlanChange(billing, subscriptionId);
    } catch (clearErr) {
        apiLogger.warn(
            {
                subscriptionId,
                newPlanId,
                error: clearErr instanceof Error ? clearErr.message : String(clearErr)
            },
            'Immediate plan swap: failed to clear pending scheduled downgrade — non-blocking'
        );
    }

    apiLogger.info(
        {
            subscriptionId,
            oldPlanId,
            newPlanId,
            customerId: changeResult.subscription.customerId
        },
        'Immediate plan swap: plan applied, no charge'
    );

    return {
        subscriptionId,
        previousPlanId: oldPlanId,
        newPlanId
    };
}
