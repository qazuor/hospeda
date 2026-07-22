/**
 * Trial-time plan upgrade — mutate-preapproval-only, no charge (HOS-211).
 *
 * ## Why this exists
 *
 * Before this flow, upgrading plans WHILE a subscription was `trialing`
 * silently reused the paid-upgrade path (`initiatePaidPlanUpgrade`), which
 * immediately charges the user the prorated delta via a one-time Checkout
 * Pro — even though nothing has been billed yet during a trial. Owner
 * decision (Stripe-style): apply the new plan now, keep the trial free, and
 * let the FIRST charge (at trial end) be at the new price. There is no
 * proration to collect because there is no paid period yet.
 *
 * ## Mechanism
 *
 * MercadoPago has already confirmed (prod smoke, 2026-07) that raising a
 * `trialing` preapproval's `auto_recurring.transaction_amount` above the
 * card's originally-authorized ceiling succeeds (HTTP 200, no re-auth
 * required, `free_trial` window preserved). So instead of a Checkout Pro,
 * this module mutates the live preapproval directly — the SAME primitive
 * used by `promo-renewal-mp.service.ts`'s `applyInitialDiscountMutation` and
 * `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`'s
 * `confirmPlanUpgrade`:
 *   `paymentAdapter.subscriptions.update(mpSubscriptionId, { transactionAmount })`
 *
 * ## Fail-closed contract (critical)
 *
 * The MP mutation runs BEFORE the local `changePlan` call, and BOTH halves of
 * the operation are hard-failed distinctly:
 *
 * - **MP mutation itself fails** (no live preapproval, no payment adapter, or
 *   MP rejects the call): throws `SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED')`.
 *   Nothing was mutated anywhere — safe, retryable, maps to HTTP 502.
 * - **MP mutation SUCCEEDS but the local `changePlan` commit throws**: throws
 *   `SubscriptionCheckoutError('TRIALING_UPGRADE_LOCAL_APPLY_FAILED')`. This is
 *   a genuine drift state — MP is already charging the new price at trial end
 *   while the local row still shows the old plan — logged via
 *   `apiLogger.error(..., { capture: true })` (pages Sentry) with an explicit
 *   "manual reconcile required" message, because `subscription-poll.job.ts`'s
 *   drift reconciler does NOT cover `trialing` rows and would never catch it
 *   on its own. Maps to HTTP 500 (server-side inconsistency, not an upstream
 *   provider failure).
 *
 * The best-effort post-apply steps (restoration, featured sync, addon
 * recalc, pending-downgrade clear) stay soft-fail — only the two hard
 * operations above (MP mutation, local `changePlan` commit) get this
 * fail-loud treatment.
 *
 * ## What this flow deliberately does NOT do
 *
 * - Never records a `billing_payments` row — there is no payment.
 * - Never writes `trialEnd`, `currentPeriodEnd`, or `status` — the webhook
 *   sync owns those; this flow only ever changes `planId`.
 * - Never calls `billing.checkout.create` — see the fail-closed contract
 *   above for why the MP interaction is a direct preapproval mutation
 *   instead.
 *
 * Modeled on `confirmPlanUpgrade` (payment-logic.ts) minus the payment
 * steps — see that function's JSDoc for the sibling paid-upgrade flow this
 * mirrors.
 *
 * @module services/billing/trialing-plan-upgrade
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
 * Input for {@link applyTrialingPlanUpgrade}.
 *
 * The caller (the trialing branch of `handlePlanChange`) already resolved
 * all of these from its own subscription/plan/price lookups — this function
 * does not re-resolve anything from `newPlanId` alone, mirroring how
 * `confirmPlanUpgrade` receives a fully-resolved metadata blob rather than
 * re-querying qzpay.
 */
export interface ApplyTrialingPlanUpgradeInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Local subscription id being upgraded (must currently be `trialing`). */
    readonly subscriptionId: string;
    /** Plan the subscription is currently on. */
    readonly oldPlanId: string;
    /** Plan the subscription is moving to. */
    readonly newPlanId: string;
    /** Target plan's price id for the subscription's billing interval. */
    readonly newPriceId: string;
    /**
     * The subscription's CURRENT price id (its billing interval's price row
     * on `oldPlanId`). Used ONLY to tighten the idempotency guard: a
     * same-plan request is a true no-op only when the price/interval also
     * matches — a same-plan cycle change (e.g. monthly → annual on the same
     * tier) has `oldPlanId === newPlanId` but a DIFFERENT price id, and must
     * still apply (WARNING 3 / HOS-211 judgment-day fix).
     */
    readonly currentPriceId: string;
    /**
     * Target plan's price, in MAJOR units (ARS) — matches the unit
     * `paymentAdapter.subscriptions.update`'s `transactionAmount` expects.
     */
    readonly targetTransactionAmountMajor: number;
    /**
     * The live MercadoPago preapproval id for this subscription
     * (`providerSubscriptionIds.mercadopago`). Required — a trialing
     * subscription with no live preapproval cannot be mutated, so its
     * absence is a fail-closed condition (see below).
     */
    readonly mpSubscriptionId: string | undefined;
    /** Drizzle client override for tests. */
    readonly db?: DrizzleClient;
}

/** Result of a successful {@link applyTrialingPlanUpgrade} call. */
export interface ApplyTrialingPlanUpgradeResult {
    readonly subscriptionId: string;
    readonly previousPlanId: string;
    readonly newPlanId: string;
    /**
     * `true` when the subscription was already on `newPlanId` and the call
     * was an idempotent no-op (no MP mutation, no local write).
     */
    readonly alreadyOnTargetPlan: boolean;
}

/**
 * Apply a plan upgrade to a `trialing` subscription with NO immediate
 * charge (HOS-211).
 *
 * Steps, in order:
 *   1. Idempotency guard — no-op ONLY if already on the exact same plan AND
 *      price/interval (`newPlanId === oldPlanId && newPriceId === currentPriceId`).
 *   2. Mutate the MP preapproval's `transaction_amount` (and `planId`) to the
 *      new plan's price. FAIL-CLOSED: on any failure (missing preapproval id,
 *      missing payment adapter, or MP rejecting the call), throws
 *      `SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED')` and
 *      applies NOTHING locally.
 *   3. Commit the plan change locally via `billing.subscriptions.changePlan`
 *      with `prorationBehavior: 'none'` (there is no paid period to
 *      prorate) and `applyAt: 'immediately'`. FAIL-LOUD: if this throws AFTER
 *      step 2 already succeeded, throws
 *      `SubscriptionCheckoutError('TRIALING_UPGRADE_LOCAL_APPLY_FAILED')` and
 *      pages Sentry via `apiLogger.error(..., { capture: true })` — this is a
 *      drift state, not a clean failure (see the module JSDoc).
 *   4. Invalidate the entitlement cache (INV-1), restore plan-restricted
 *      resources, sync `featuredByEntitlement`, recalculate addon limits,
 *      and clear any pending scheduled downgrade — all best-effort,
 *      mirroring `confirmPlanUpgrade`'s post-apply steps exactly.
 *
 * Deliberately never touches `trialEnd` / `currentPeriodEnd` / `status` —
 * the webhook sync owns those. Only `planId` changes here.
 *
 * @throws SubscriptionCheckoutError with code `MP_PREAPPROVAL_MUTATION_FAILED`
 *   when the MP mutation itself cannot be applied — nothing was mutated,
 *   the local subscription is left untouched.
 * @throws SubscriptionCheckoutError with code `TRIALING_UPGRADE_LOCAL_APPLY_FAILED`
 *   when the MP mutation succeeded but the local `changePlan` commit failed
 *   afterward — a drift state requiring manual reconciliation.
 */
export async function applyTrialingPlanUpgrade(
    input: ApplyTrialingPlanUpgradeInput
): Promise<ApplyTrialingPlanUpgradeResult> {
    const {
        billing,
        subscriptionId,
        oldPlanId,
        newPlanId,
        newPriceId,
        currentPriceId,
        targetTransactionAmountMajor,
        mpSubscriptionId,
        db
    } = input;

    // Step 1: idempotency guard — mirrors confirmPlanUpgrade's early return,
    // but WARNING 3-tightened: a same-plan request is a true no-op only when
    // the price/interval ALSO matches. A same-plan cycle change (e.g. monthly
    // → annual on the same tier) has oldPlanId === newPlanId but a different
    // price id and must still apply — swallowing it here would silently
    // return success without ever touching MP or the local plan.
    if (oldPlanId === newPlanId && newPriceId === currentPriceId) {
        apiLogger.info(
            { subscriptionId, newPlanId },
            'Trialing plan upgrade: subscription already on target plan and price — idempotent skip'
        );
        return {
            subscriptionId,
            previousPlanId: oldPlanId,
            newPlanId,
            alreadyOnTargetPlan: true
        };
    }

    // Step 2: mutate the MP preapproval FIRST, fail-closed. The local plan
    // change below must never run unless this succeeds.
    if (!mpSubscriptionId) {
        const message =
            'Trialing subscription has no linked MercadoPago preapproval — cannot apply the upgrade without a live preapproval to mutate';
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

    // HOS-231: pass the plan display name as the MP preapproval `reason` so the
    // buyer sees e.g. "VIP" instead of the raw plan UUID ("Plan updated to:
    // <uuid>") in their MercadoPago panel and notification email. `undefined`
    // keeps the adapter's synthetic fallback. Resolved BEFORE the MP call (and
    // outside the try) so a best-effort name lookup never runs mid-mutation —
    // mirroring the three sibling plan-change paths (immediate-plan-swap,
    // apply-scheduled-plan-changes, confirmPlanUpgrade). This trial path was the
    // only cross-plan mutation that still omitted it (HOS-220 missed it).
    const reason = await resolvePlanChangeReason({ planId: newPlanId });

    // WARNING 4: the try block wraps ONLY the MP call itself — the
    // success-path log below lives OUTSIDE it, so a (hypothetical) logger
    // throw can never be misreported as an MP rejection.
    try {
        await paymentAdapter.subscriptions.update(mpSubscriptionId, {
            // CRITICAL 2: this is a CROSS-plan mutation (oldPlanId !== newPlanId
            // by this point), unlike applyInitialDiscountMutation's same-plan
            // discount mutation — planId must be included, mirroring the two
            // existing cross-plan precedents (payment-logic.ts's
            // confirmPlanUpgrade and apply-scheduled-plan-changes.ts's applyOne).
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
            'Trialing plan upgrade: MP rejected the new plan amount — failing closed (plan NOT changed)'
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
        'Trialing plan upgrade: applied new plan amount to MP preapproval, no charge (trial preserved)'
    );

    // Step 3: commit the local plan change — only after the MP mutation
    // succeeded. No proration: there is no paid period yet during a trial.
    //
    // CRITICAL 1 (fail-loud, not soft-fail): if this throws, MP has ALREADY
    // been mutated to the new price one step above — a genuine local/MP
    // drift state, not a clean failure. `subscription-poll.job.ts`'s drift
    // reconciler does NOT cover `trialing` rows, so this would otherwise go
    // undetected until the trial ends and MP charges an amount the local
    // plan never reflects. Page loudly via `{ capture: true }` instead of
    // letting it fall through as a generic, unremarkable 500.
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
            'Trialing plan upgrade: MP preapproval already mutated to the new price but local plan change failed — manual reconcile required',
            { capture: true }
        );
        throw new SubscriptionCheckoutError(
            'TRIALING_UPGRADE_LOCAL_APPLY_FAILED',
            `MercadoPago was already updated to the new price, but the local plan change failed — manual reconcile required: ${rawMessage}`
        );
    }

    // INV-1: invalidate the entitlement middleware cache for this customer.
    // Synchronous, in-process, no I/O — safe to call unconditionally.
    clearEntitlementCache(changeResult.subscription.customerId);

    // Step 4a: restore plan-restricted resources + sync featuredByEntitlement.
    // Soft-fail wrapper — mirrors confirmPlanUpgrade exactly: restoration
    // failure must NOT undo the plan change, which already committed above.
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
                const upgradedPlanHasFeatured = await resolveOwnerPlanGrantsFeatured({
                    ownerId: userId
                });
                await syncFeaturedByEntitlementForOwner({
                    ownerId: userId,
                    active: upgradedPlanHasFeatured
                });
                apiLogger.info(
                    {
                        subscriptionId,
                        newPlanId,
                        active: upgradedPlanHasFeatured,
                        customerId: changeResult.subscription.customerId
                    },
                    'Trialing plan upgrade: featuredByEntitlement synced'
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
                    'Trialing plan upgrade: syncFeaturedByEntitlementForOwner failed (non-blocking)'
                );
            }
        } else {
            apiLogger.warn(
                { subscriptionId, newPlanId, customerId: changeResult.subscription.customerId },
                'Trialing plan upgrade: could not resolve owner userId for upgrade restoration — skipped'
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
            'Trialing plan upgrade: upgrade restoration step threw unexpectedly — plan change committed, manual restoration may be needed'
        );
    }

    // Step 4b: refresh addon limits — best-effort.
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
            'Trialing plan upgrade: addon recalculation failed — non-blocking'
        );
    }

    // Step 4c: race-condition cleanup — if the user had a downgrade queued
    // before the upgrade landed, clear it. Best-effort.
    try {
        await clearPendingScheduledPlanChange(billing, subscriptionId);
    } catch (clearErr) {
        apiLogger.warn(
            {
                subscriptionId,
                newPlanId,
                error: clearErr instanceof Error ? clearErr.message : String(clearErr)
            },
            'Trialing plan upgrade: failed to clear pending scheduled downgrade — non-blocking'
        );
    }

    apiLogger.info(
        {
            subscriptionId,
            oldPlanId,
            newPlanId,
            customerId: changeResult.subscription.customerId
        },
        'Trialing plan upgrade: plan applied, no charge, trial window preserved'
    );

    return {
        subscriptionId,
        previousPlanId: oldPlanId,
        newPlanId,
        alreadyOnTargetPlan: false
    };
}
