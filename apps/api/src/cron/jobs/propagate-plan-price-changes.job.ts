/**
 * Propagate Plan Price Changes Cron Job (HOS-176).
 *
 * Applies enqueued `billing_plan_price_changes` (written by `updatePlan` when an
 * admin edits a plan's price) to each affected subscriber's MercadoPago preapproval,
 * so MP stops charging the stale amount. Fires every 15 minutes.
 *
 * SCOPE. DECREASES are always processed (frictionless — no legal notice, no chargeback
 * risk; only ever lowers `transaction_amount` to a value at/below what the subscriber
 * authorized, the proven-safe direction, spike §3.2).
 *
 * INCREASES (HOS-176 Increment A) are processed ONLY when
 * `env.HOSPEDA_BILLING_PRICE_INCREASE_ENABLED` is true. The D-1 MP sandbox smoke
 * confirmed that raising `auto_recurring.transaction_amount` above the originally
 * authorized amount returns HTTP 200 with NO re-authorization, so the increase uses
 * the SAME silent `paymentAdapter.subscriptions.update` mutation as a decrease. Legal
 * (Disp. 954/2025) requires PRIOR notice + a grace window, so an increase has an extra
 * lifecycle stage: `pending` → (notice phase sends the advance notice) → `noticing`
 * (`noticeSentAt` stamped, `effectiveAt` recomputed to `noticeSentAt + 15 days`) →
 * (after `effectiveAt`) apply, reusing the existing `applyChange` → `done`/`failed`.
 * When the flag is false, increases stay `pending` untouched (safe default: no notice,
 * no MP mutation). Two owner decisions shape the increase apply:
 *   - Grace window = 15 days (owner decision).
 *   - Trialing subs are GRANDFATHERED: they receive the notice but keep the OLD price
 *     through their in-flight trial, so they are EXCLUDED from the apply enumeration
 *     for increases (decreases still include them — lowering a trialing sub is fine).
 *
 * Two hard MP amount limits (both directions; decisive for increases): MP rejects a
 * `transaction_amount` > 2,000,000 ARS absolute and ≤ 0 — a target with such an amount
 * is marked terminal `skipped` (never sent to MP) so it surfaces to ops instead of
 * failing the MP call repeatedly.
 *
 * Idempotency (mirrors `apply-scheduled-plan-changes`):
 *   - Target rows are created with `ON CONFLICT DO NOTHING` on
 *     `(price_change_id, subscription_id)` — re-running never duplicates.
 *   - Only `pending` targets are mutated; the MP `subscriptions.update` sets an
 *     absolute amount, so re-applying the same target converges.
 *   - Targets are created in batches of up to `MAX_TARGETS_PER_CHANGE` per tick
 *     (already-targeted subs are excluded), so a plan with more subscribers than the
 *     per-tick cap is drained across ticks rather than silently truncated.
 *   - A target that keeps failing its MP mutation goes terminal `failed` after
 *     `MAX_TARGET_TICK_ATTEMPTS`, so it can't wedge the change in `applying` forever.
 *   - A target whose discount-aware amount cannot be DETERMINED (e.g. a deleted promo)
 *     is persisted as `deferred` and re-resolved each tick under the SAME
 *     `MAX_TARGET_TICK_ATTEMPTS` budget; once exhausted it goes terminal `skipped`
 *     (keeps its OLD amount) so an undeterminable sub also can't wedge the change (C1).
 *   - The change is finalized only when no `pending` AND no `deferred` targets remain
 *     AND no new un-targeted subs were found this tick: header goes `failed` if any
 *     target is `failed` OR `skipped`, else `done`.
 *
 * Discount-awareness (mandatory, spike §4.4): a subscriber with an active multi-cycle
 * discount must be re-priced to the DISCOUNTED amount on the NEW price, never the raw
 * new full price — otherwise the cron would clobber a live discount. Non-amount promo
 * effects (comp / trial-extension) do NOT reduce the recurring charge, so the full new
 * price is correct for them — they are never deferred (deferring a `trial_extension`
 * on a trialing sub was the deterministic C1 wedge).
 *
 * @module cron/jobs/propagate-plan-price-changes
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    and,
    asc,
    billingPlanPriceChanges,
    billingPlanPriceChangeTargets,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNotNull,
    isNull,
    lte,
    or,
    sql
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import {
    calculatePromoCodeEffect,
    getPromoCodeById,
    loadSubscriptionDiscountState
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { planDisplayNameFromPlan } from '../../services/billing/plan-change-reason.js';
import { env } from '../../utils/env.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/** Hard cap on price-change rows processed per tick (safety valve). */
const MAX_CHANGES_PER_TICK = 50;

/**
 * Hard cap on subscriber targets CREATED per change per tick. Not a total ceiling:
 * subscribers beyond this count are targeted on subsequent ticks (batched — I1),
 * because `findAffectedSubscribers` excludes already-targeted subs, so the change is
 * not finalized until every affected sub has a target.
 */
const MAX_TARGETS_PER_CHANGE = 500;

/**
 * Subscription statuses whose preapproval we re-price for a DECREASE (all live,
 * chargeable subs — lowering a trialing sub's price is harmless).
 */
const AFFECTED_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const;

/**
 * Subscription statuses re-priced for an INCREASE. `trialing` is EXCLUDED
 * (owner decision D-4: trialing subs are grandfathered — they keep the OLD price
 * through their in-flight trial). Note this is the APPLY-time set; the notice
 * phase still notifies trialing subs (they are affected).
 *
 * FOLLOW-UP: full "new price from the cycle following the trial" re-pricing of a
 * grandfathered trialing sub needs a post-first-charge re-price hook and is out of
 * scope for Increment A. v1 leaves them at the old amount; the divergence detector
 * (separate follow-up) will surface them.
 */
const INCREASE_AFFECTED_SUB_STATUSES = ['active', 'past_due'] as const;

/**
 * MercadoPago's absolute ceiling on `auto_recurring.transaction_amount`, in ARS
 * MAJOR units. MP returns HTTP 400 ("Cannot pay an amount greater than
 * $ 2000000.00") for any amount strictly above this (D-1 smoke). A target whose
 * amount exceeds it is marked terminal `skipped` — never sent to MP.
 */
const MP_MAX_TRANSACTION_AMOUNT_ARS = 2_000_000;

/** Grace window (ms) between an increase's advance notice and its apply (15 days, D-3). */
const INCREASE_NOTICE_GRACE_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Pure: the apply-time affected-subscriber status filter for a price change,
 * parameterized by direction. Increases exclude `trialing` (grandfathered, D-4);
 * decreases include it.
 *
 * @internal
 */
function affectedStatusesForDirection(direction: string): readonly string[] {
    return direction === 'increase'
        ? [...INCREASE_AFFECTED_SUB_STATUSES]
        : [...AFFECTED_SUB_STATUSES];
}

/**
 * Pure: validate a target amount against MP's absolute limits BEFORE any MP call.
 * MP rejects `transaction_amount` ≤ 0 and > {@link MP_MAX_TRANSACTION_AMOUNT_ARS}
 * ARS major (D-1 smoke). A non-ok result must be marked terminal `skipped` (never
 * sent to MP), which forces the header to `failed` at finalize so ops sees it.
 *
 * @param input.targetAmountCentavos - The target amount in integer centavos.
 * @internal
 */
function classifyTargetAmountGuard(input: {
    readonly targetAmountCentavos: number;
}):
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: 'non_positive' | 'exceeds_mp_max' } {
    if (input.targetAmountCentavos <= 0) {
        return { ok: false, reason: 'non_positive' };
    }
    if (input.targetAmountCentavos / 100 > MP_MAX_TRANSACTION_AMOUNT_ARS) {
        return { ok: false, reason: 'exceeds_mp_max' };
    }
    return { ok: true };
}

/**
 * Intra-tick retry count for a SINGLE best-effort MP amount mutation within one
 * `applyChange` pass. Distinct from {@link MAX_TARGET_TICK_ATTEMPTS}: this is the
 * inner loop inside `applyMpAmount` (retries the one MP call a few times before
 * giving up FOR THIS TICK), whereas MAX_TARGET_TICK_ATTEMPTS is the CUMULATIVE
 * across-tick budget after which a target is marked terminal `failed`.
 */
const MP_UPDATE_MAX_ATTEMPTS = 3;
const MP_UPDATE_RETRY_DELAY_MS = 400;

/**
 * Cumulative per-target attempt budget ACROSS ticks. Each tick that fails to mutate
 * a target increments its `attemptCount`; once it reaches this budget the target is
 * marked terminal `failed` instead of retried forever, so a permanently-failing
 * target cannot wedge its parent change in `applying` indefinitely. Distinct from
 * {@link MP_UPDATE_MAX_ATTEMPTS} (the intra-tick retry count for one MP call).
 */
const MAX_TARGET_TICK_ATTEMPTS = 5;

interface DueChangeRow {
    readonly id: string;
    readonly planId: string;
    readonly billingInterval: string;
    readonly newAmount: number;
    readonly direction: string;
}

interface AffectedSubRow {
    readonly subscriptionId: string;
    readonly mpSubscriptionId: string | null;
}

/** Outcome of discount-aware target resolution: a concrete amount, or "defer". */
type DiscountAwareResolution = { readonly amount: number } | { readonly defer: true };

/**
 * Resolve the discount-aware target amount (integer centavos) for a subscription
 * given the new full price. Mirrors `resolveDiscountAwarePlanChangeAmount`
 * (apply-scheduled-plan-changes) but uses the enqueued `newAmount` as the base, so
 * it never depends on the interval-ambiguous `resolveFullPlanPriceCentavos`.
 *
 * DEFER means only ONE thing: "we genuinely could not DETERMINE the amount" — a
 * transient lookup failure, a deleted promo, or any thrown error. Everything that is
 * determinable returns a concrete `{ amount }`. Falling open to the full new price is
 * therefore done ONLY when the discount state was successfully read and PROVED there
 * is no amount-reducing discount (no promo, exhausted promo, or a non-`apply-discount`
 * effect such as comp / trial-extension that does not lower the recurring charge). A
 * THROW is NOT proof of "no discount": it defers (protecting a possibly-discounted sub
 * from being inverted into an MP increase).
 *
 * Returns:
 *   - state null OR no `promoCodeId` → `{ amount: newFullCentavos }` (provably no discount).
 *   - `promoCodeId` present but exhausted (`remaining !== null && remaining <= 0`) →
 *     `{ amount: newFullCentavos }`.
 *   - active `promoCodeId`:
 *       - `getPromoCodeById` `!success` → `{ defer: true }` (transient failure OR deleted
 *         promo — cannot determine; the DEFER budget in `applyChange` bounds it).
 *       - success but no amount `effect` → `{ amount: newFullCentavos }`.
 *       - `apply-discount` effect → `{ amount: mutation.finalAmount }`.
 *       - any OTHER effect (comp-subscription, extend-trial, …) → `{ amount: newFullCentavos }`
 *         (these do NOT reduce the recurring amount — full price is correct; NEVER defer).
 *   - THROW (loadSubscriptionDiscountState / getPromoCodeById) → `{ defer: true }`.
 *
 * @internal
 */
async function resolveDiscountAwareTargetCentavos(
    subscriptionId: string,
    newFullCentavos: number
): Promise<DiscountAwareResolution> {
    try {
        const discountState = await loadSubscriptionDiscountState({ subscriptionId });
        if (!discountState?.promoCodeId) {
            return { amount: newFullCentavos };
        }
        const remaining = discountState.promoEffectRemainingCycles;
        // Exhausted (finite countdown at/below zero) → full price is correct.
        if (remaining !== null && remaining <= 0) {
            return { amount: newFullCentavos };
        }
        // Active promo: look it up. A lookup failure (transient OR deleted promo) is
        // not determinable → defer (bounded by the applyChange defer budget).
        const promoResult = await getPromoCodeById(discountState.promoCodeId);
        if (!promoResult.success) {
            return { defer: true };
        }
        // Success but no amount effect → the promo does not touch the recurring
        // amount, so the full new price is correct.
        if (!promoResult.data?.effect) {
            return { amount: newFullCentavos };
        }
        const mutation = calculatePromoCodeEffect(promoResult.data.effect, newFullCentavos);
        if (mutation.type === 'apply-discount') {
            return { amount: mutation.finalAmount };
        }
        // Any other effect (comp-subscription, extend-trial, …) does NOT reduce the
        // recurring amount — full price is correct. NEVER defer here: deferring a
        // non-amount effect (e.g. a trial_extension on a trialing sub) is what wedged
        // the change in `applying` forever (C1).
        return { amount: newFullCentavos };
    } catch (err) {
        Sentry.captureException(
            new Error(
                `HOS-176: discount-aware target resolution failed: ${
                    err instanceof Error ? err.message : String(err)
                }`
            ),
            { extra: { subscriptionId }, tags: { module: 'propagate-plan-price-changes' } }
        );
        // A throw is NOT proof of "no discount" — it means we could not determine the
        // amount. Defer (never fall open to the higher full price, which could invert
        // this decrease into an MP increase for a genuinely-discounted sub — W2res).
        return { defer: true };
    }
}

/**
 * Pure: decide a target's next status after an exhausted intra-tick MP mutation.
 * Once the cumulative across-tick attempt budget ({@link MAX_TARGET_TICK_ATTEMPTS})
 * is reached the target becomes terminal `failed` (so it can't wedge the change);
 * otherwise it stays `pending` for a retry next tick. `attemptCount` is the value
 * BEFORE this tick's failure.
 *
 * @internal
 */
function nextTargetStatusOnFailure(input: { readonly attemptCount: number }): {
    readonly status: 'pending' | 'failed';
    readonly nextAttempt: number;
} {
    const nextAttempt = input.attemptCount + 1;
    return {
        status: nextAttempt >= MAX_TARGET_TICK_ATTEMPTS ? 'failed' : 'pending',
        nextAttempt
    };
}

/**
 * Pure: decide a DEFERRED target's next status after another tick that still could
 * not resolve its discount-aware amount. Reuses {@link MAX_TARGET_TICK_ATTEMPTS} as
 * the cumulative across-tick budget: once reached the target becomes terminal
 * `skipped` (we give up re-pricing — it keeps the OLD amount), otherwise it stays
 * `deferred` for another retry. `attemptCount` counts ticks this target failed to
 * resolve/apply and is the value BEFORE this tick's failure. Mirrors
 * {@link nextTargetStatusOnFailure} (MP-mutation budget) so the two carriles share
 * one budget with consistent semantics.
 *
 * @internal
 */
function nextDeferStatus(input: { readonly attemptCount: number }): {
    readonly status: 'deferred' | 'skipped';
    readonly nextAttempt: number;
} {
    const nextAttempt = input.attemptCount + 1;
    return {
        status: nextAttempt >= MAX_TARGET_TICK_ATTEMPTS ? 'skipped' : 'deferred',
        nextAttempt
    };
}

/**
 * Pure: a change may be finalized only when no `pending` targets remain, no
 * `deferred` targets remain (they are still being retried), AND this tick found no
 * new un-targeted subscribers (overflow batching complete — I1). `skipped`/`failed`
 * targets are terminal and do NOT block finalization.
 *
 * @internal
 */
function shouldFinalize(input: {
    readonly pendingCount: number;
    readonly deferredCount: number;
    readonly newSubsFound: number;
}): boolean {
    return input.pendingCount === 0 && input.deferredCount === 0 && input.newSubsFound === 0;
}

/**
 * Load due price changes whose `effectiveAt` has elapsed and are not yet finalized.
 *
 * DECREASES are always included (`status IN ('pending','applying')`). INCREASES are
 * included ONLY when `increaseEnabled` is true, and only once they have passed their
 * notice phase (`status IN ('noticing','applying')`) — a `pending` increase has not
 * been noticed yet and must NOT be applied. When the flag is off, increases are never
 * returned here (they stay `pending`, untouched).
 *
 * OPERATOR KILL-SWITCH SEMANTICS (I2): turning `HOSPEDA_BILLING_PRICE_INCREASE_ENABLED`
 * OFF is a hard kill-switch that STRANDS any increase already mid-flight in `noticing`
 * or `applying` — this query stops selecting it, so it is neither advanced nor rolled
 * back until the flag is re-enabled. This is the intended operator semantics (an
 * increase already noticed to customers is paused in place, not silently reverted),
 * documented here so it is not a surprise during an incident.
 *
 * @param input.increaseEnabled - Whether the increase path is enabled.
 */
async function findDueChanges(input: {
    readonly increaseEnabled: boolean;
}): Promise<DueChangeRow[]> {
    const db = getDb();
    const now = new Date();
    const projection = {
        id: billingPlanPriceChanges.id,
        planId: billingPlanPriceChanges.planId,
        billingInterval: billingPlanPriceChanges.billingInterval,
        newAmount: billingPlanPriceChanges.newAmount,
        direction: billingPlanPriceChanges.direction
    };
    const decreaseCond = and(
        eq(billingPlanPriceChanges.direction, 'decrease'),
        inArray(billingPlanPriceChanges.status, ['pending', 'applying']),
        lte(billingPlanPriceChanges.effectiveAt, now)
    );
    // Only past-notice increases are due; `pending` increases still await their notice.
    // S2 (deferred follow-up): the `noticing` branch is NOT covered by the partial index
    // on this table — adding it needs a migration, deliberately not done here. The table
    // is tiny (one row per admin price edit), so the seq-scan cost is negligible for now.
    const increaseCond = and(
        eq(billingPlanPriceChanges.direction, 'increase'),
        inArray(billingPlanPriceChanges.status, ['noticing', 'applying']),
        lte(billingPlanPriceChanges.effectiveAt, now)
    );
    const where = input.increaseEnabled ? or(decreaseCond, increaseCond) : decreaseCond;
    const rows = await db
        .select(projection)
        .from(billingPlanPriceChanges)
        .where(where)
        // Apply oldest-effective first (tie-break by creation) so concurrent
        // changes converge deterministically to the newest amount (W2).
        .orderBy(asc(billingPlanPriceChanges.effectiveAt), asc(billingPlanPriceChanges.createdAt))
        .limit(MAX_CHANGES_PER_TICK);
    return rows;
}

/**
 * Live subscribers on a plan+interval carrying an MP preapproval that do NOT yet
 * have a target row for THIS change. Excluding already-targeted subs means each tick
 * batches up to {@link MAX_TARGETS_PER_CHANGE} not-yet-targeted subs (I1) and never
 * recomputes a discount for a sub already targeted. Deterministic order (by id) makes
 * the batching stable across ticks.
 */
async function findAffectedSubscribers(
    planId: string,
    billingInterval: string,
    changeId: string,
    statuses: readonly string[]
): Promise<AffectedSubRow[]> {
    const db = getDb();
    const rows = await db
        .select({
            subscriptionId: billingSubscriptions.id,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.planId, planId),
                eq(billingSubscriptions.billingInterval, billingInterval),
                inArray(billingSubscriptions.status, [...statuses]),
                isNotNull(billingSubscriptions.mpSubscriptionId),
                sql`NOT EXISTS (SELECT 1 FROM ${billingPlanPriceChangeTargets} t WHERE t.price_change_id = ${changeId} AND t.subscription_id = ${billingSubscriptions.id})`
            )
        )
        .orderBy(asc(billingSubscriptions.id))
        .limit(MAX_TARGETS_PER_CHANGE);
    return rows;
}

/** Row shape for the notice phase: enough to resolve the customer + email. */
interface NoticeSubRow {
    readonly subscriptionId: string;
    readonly customerId: string;
}

/**
 * ALL live subscribers on a plan+interval carrying an MP preapproval, WITHOUT the
 * NOT-EXISTS-target filter (unlike {@link findAffectedSubscribers}). Used by the
 * increase notice phase, which must notify every affected subscriber — including
 * trialing subs (grandfathered at apply time, but still legally notified).
 *
 * @param planId - Plan UUID.
 * @param billingInterval - `month` | `year`.
 * @param statuses - Affected statuses (notice phase uses the full live set).
 */
async function findAllAffectedSubscribers(
    planId: string,
    billingInterval: string,
    statuses: readonly string[]
): Promise<NoticeSubRow[]> {
    const db = getDb();
    const rows = await db
        .select({
            subscriptionId: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId
        })
        .from(billingSubscriptions)
        .where(
            and(
                eq(billingSubscriptions.planId, planId),
                eq(billingSubscriptions.billingInterval, billingInterval),
                inArray(billingSubscriptions.status, [...statuses]),
                isNotNull(billingSubscriptions.mpSubscriptionId)
            )
        )
        .orderBy(asc(billingSubscriptions.id))
        .limit(MAX_TARGETS_PER_CHANGE);
    return rows;
}

/** Create (idempotently) a target row per affected subscriber for this change. */
async function ensureTargets(
    change: DueChangeRow,
    subs: AffectedSubRow[],
    logger: CronJobContextLogger
): Promise<void> {
    if (subs.length === 0) return;
    const db = getDb();
    for (const sub of subs) {
        const resolution = await resolveDiscountAwareTargetCentavos(
            sub.subscriptionId,
            change.newAmount
        );
        const deferred = 'defer' in resolution;
        if (deferred) {
            // Could not DETERMINE the amount this tick. Persist a `deferred` target
            // (NOT skip the insert — skipping is what wedged the change, because
            // findAffectedSubscribers would re-enumerate the sub every tick and
            // newSubsFound never reached 0). The `deferred` row stops re-enumeration
            // and is re-resolved by applyChange under a bounded budget (C1 / Part B).
            // `targetAmount` here is a placeholder (full new price) that is NOT used
            // while the row stays `deferred`.
            logger.info('Price propagation: deferring subscriber (amount undetermined)', {
                priceChangeId: change.id,
                subscriptionId: sub.subscriptionId
            });
        }
        await db
            .insert(billingPlanPriceChangeTargets)
            .values({
                priceChangeId: change.id,
                subscriptionId: sub.subscriptionId,
                mpSubscriptionId: sub.mpSubscriptionId,
                targetAmount: deferred ? change.newAmount : resolution.amount,
                status: deferred ? 'deferred' : 'pending'
            })
            .onConflictDoNothing({
                target: [
                    billingPlanPriceChangeTargets.priceChangeId,
                    billingPlanPriceChangeTargets.subscriptionId
                ]
            });
    }
}

/** Best-effort MP amount mutation with bounded retry. Never throws. */
async function applyMpAmount(
    billing: QZPayBilling,
    mpSubscriptionId: string,
    targetAmountMajor: number
): Promise<{ ok: true } | { ok: false; error: string }> {
    const paymentAdapter = billing.getPaymentAdapter();
    if (!paymentAdapter) {
        return { ok: false, error: 'MP payment adapter unavailable' };
    }
    let lastError = '';
    for (let attempt = 1; attempt <= MP_UPDATE_MAX_ATTEMPTS; attempt += 1) {
        try {
            await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                transactionAmount: targetAmountMajor
            });
            return { ok: true };
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            if (attempt < MP_UPDATE_MAX_ATTEMPTS) {
                await new Promise((r) => setTimeout(r, MP_UPDATE_RETRY_DELAY_MS));
            }
        }
    }
    return { ok: false, error: lastError };
}

interface ApplyChangeOutcome {
    readonly targetsApplied: number;
    readonly targetsFailed: number;
    readonly done: boolean;
}

/**
 * Apply one due price change (increase OR decrease): create targets, mutate pending
 * ones, finalize. Direction is parameterized via the affected-status filter; the apply
 * mechanism (absolute MP `transaction_amount` mutation) is identical for both.
 */
async function applyChange(
    change: DueChangeRow,
    billing: QZPayBilling,
    logger: CronJobContextLogger
): Promise<ApplyChangeOutcome> {
    const db = getDb();
    const now = new Date();

    // Mark applying (idempotent; also takes 'pending' → 'applying').
    await db
        .update(billingPlanPriceChanges)
        .set({ status: 'applying', updatedAt: now })
        .where(eq(billingPlanPriceChanges.id, change.id));

    // (Part B) Re-resolve DEFERRED targets from prior ticks BEFORE enumerating new
    // subs, so a freshly-inserted `deferred` row (see ensureTargets) is not also
    // re-processed the same tick. A target whose amount is now determinable is
    // promoted to `pending`; one that still cannot be resolved has its defer budget
    // bumped and goes terminal `skipped` once exhausted — this is what lets a
    // permanently-undeterminable sub (e.g. a deleted promo) finalize instead of
    // wedging the change in `applying` forever (C1).
    const deferredTargets = await db
        .select({
            id: billingPlanPriceChangeTargets.id,
            subscriptionId: billingPlanPriceChangeTargets.subscriptionId,
            attemptCount: billingPlanPriceChangeTargets.attemptCount
        })
        .from(billingPlanPriceChangeTargets)
        .where(
            and(
                eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                eq(billingPlanPriceChangeTargets.status, 'deferred')
            )
        );

    for (const t of deferredTargets) {
        const resolution = await resolveDiscountAwareTargetCentavos(
            t.subscriptionId,
            change.newAmount
        );
        if ('defer' in resolution) {
            const { status: nextStatus, nextAttempt } = nextDeferStatus({
                attemptCount: t.attemptCount
            });
            await db
                .update(billingPlanPriceChangeTargets)
                .set({
                    status: nextStatus,
                    attemptCount: nextAttempt,
                    lastAttemptAt: now,
                    updatedAt: now
                })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            if (nextStatus === 'skipped') {
                // Terminal: we could not re-price this sub within the defer budget.
                // It keeps its OLD amount. Surface to ops (honest partial failure).
                Sentry.captureException(
                    new Error(
                        `HOS-176: gave up re-pricing subscription ${t.subscriptionId} after ${nextAttempt} defer attempts (marked skipped; keeps OLD amount)`
                    ),
                    {
                        extra: { priceChangeId: change.id, subscriptionId: t.subscriptionId },
                        tags: { module: 'propagate-plan-price-changes' }
                    }
                );
                logger.warn('Price propagation: gave up re-pricing subscriber (marked skipped)', {
                    priceChangeId: change.id,
                    subscriptionId: t.subscriptionId,
                    attemptCount: nextAttempt
                });
            }
        } else {
            // Amount now determinable — promote to `pending` (mutated this tick below
            // or next). Placeholder targetAmount is replaced with the resolved value.
            await db
                .update(billingPlanPriceChangeTargets)
                .set({ targetAmount: resolution.amount, status: 'pending', updatedAt: now })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
        }
    }

    // Direction-parameterized status filter: increases EXCLUDE trialing subs
    // (grandfathered — kept at the OLD amount through their trial, D-4); decreases
    // include them (lowering a trialing sub's price is harmless).
    const subs = await findAffectedSubscribers(
        change.planId,
        change.billingInterval,
        change.id,
        affectedStatusesForDirection(change.direction)
    );
    await ensureTargets(change, subs, logger);
    // New (not-yet-targeted) subs found this tick. While > 0 the change is not
    // finalized — there may be more overflow subs to batch next tick (I1).
    const newSubsFound = subs.length;

    // Load pending targets for this change and mutate each (includes any just
    // promoted from `deferred` above).
    const pending = await db
        .select({
            id: billingPlanPriceChangeTargets.id,
            subscriptionId: billingPlanPriceChangeTargets.subscriptionId,
            mpSubscriptionId: billingPlanPriceChangeTargets.mpSubscriptionId,
            targetAmount: billingPlanPriceChangeTargets.targetAmount,
            attemptCount: billingPlanPriceChangeTargets.attemptCount
        })
        .from(billingPlanPriceChangeTargets)
        .where(
            and(
                eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                eq(billingPlanPriceChangeTargets.status, 'pending')
            )
        );

    let targetsApplied = 0;
    let targetsFailed = 0;

    for (const t of pending) {
        // MP amount guards (both directions; decisive for increases). Run BEFORE any
        // MP call: MP rejects amounts ≤ 0 and > MP_MAX_TRANSACTION_AMOUNT_ARS with a
        // HTTP 400 (D-1 smoke), so retrying the mutation would just burn the attempt
        // budget. Mark the target terminal `skipped` (keeps its OLD amount) and surface
        // to ops via Sentry. A `skipped` target forces the header to `failed` at
        // finalize (existing logic), so the invalid plan price is not silently swallowed.
        const guard = classifyTargetAmountGuard({ targetAmountCentavos: t.targetAmount });
        if (!guard.ok) {
            await db
                .update(billingPlanPriceChangeTargets)
                .set({
                    status: 'skipped',
                    lastError:
                        guard.reason === 'non_positive'
                            ? 'invalid amount ≤ 0 — not sent to MP'
                            : `plan price exceeds MP ${MP_MAX_TRANSACTION_AMOUNT_ARS} ARS absolute cap — not sent to MP`,
                    lastAttemptAt: now,
                    updatedAt: now
                })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            targetsFailed += 1;
            Sentry.captureException(
                new Error(
                    guard.reason === 'non_positive'
                        ? `HOS-176: target amount ≤ 0 for subscription ${t.subscriptionId} — never sent to MP (marked skipped)`
                        : `HOS-176: plan price exceeds MP's ${MP_MAX_TRANSACTION_AMOUNT_ARS} ARS absolute cap for subscription ${t.subscriptionId} — cannot propagate; ops must review the plan price (marked skipped)`
                ),
                {
                    extra: {
                        priceChangeId: change.id,
                        subscriptionId: t.subscriptionId,
                        targetAmountCentavos: t.targetAmount
                    },
                    tags: { module: 'propagate-plan-price-changes' }
                }
            );
            logger.warn('Price propagation: target amount rejected by MP guard (marked skipped)', {
                priceChangeId: change.id,
                subscriptionId: t.subscriptionId,
                reason: guard.reason,
                targetAmountCentavos: t.targetAmount
            });
            continue;
        }
        if (!t.mpSubscriptionId) {
            // No preapproval to mutate — mark applied (nothing to do) so it does not
            // block the change from completing.
            await db
                .update(billingPlanPriceChangeTargets)
                .set({ status: 'applied', appliedAt: now, updatedAt: now })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            targetsApplied += 1;
            continue;
        }
        const result = await applyMpAmount(billing, t.mpSubscriptionId, t.targetAmount / 100);
        if (result.ok) {
            await db
                .update(billingPlanPriceChangeTargets)
                .set({ status: 'applied', appliedAt: now, updatedAt: now })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            targetsApplied += 1;
        } else {
            // Increment the cumulative attempt count; once the across-tick budget is
            // reached the target goes terminal `failed` so it can't wedge the change
            // in `applying` forever (W1). Otherwise stays `pending` for a retry.
            const { status: nextStatus, nextAttempt } = nextTargetStatusOnFailure({
                attemptCount: t.attemptCount
            });
            await db
                .update(billingPlanPriceChangeTargets)
                .set({
                    status: nextStatus,
                    attemptCount: nextAttempt,
                    lastError: result.error,
                    lastAttemptAt: now,
                    updatedAt: now
                })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            targetsFailed += 1;
            logger.warn(
                nextStatus === 'failed'
                    ? 'Price propagation: MP amount update failed permanently (target marked failed)'
                    : 'Price propagation: MP amount update failed (will retry next tick)',
                {
                    priceChangeId: change.id,
                    subscriptionId: t.subscriptionId,
                    error: result.error,
                    attemptCount: nextAttempt
                }
            );
        }
    }

    // Count remaining pending AND deferred targets. The change is finalized only when
    // neither remains AND this tick found no new un-targeted subs (overflow batching
    // done — I1). Deferred targets are still being retried, so they block finalization
    // exactly like pending ones (C1: otherwise a deferred sub would be re-enumerated
    // forever while the header sat wedged in `applying`).
    const [remaining] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(billingPlanPriceChangeTargets)
        .where(
            and(
                eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                eq(billingPlanPriceChangeTargets.status, 'pending')
            )
        );
    const pendingCount = remaining?.n ?? 0;
    const [remainingDeferred] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(billingPlanPriceChangeTargets)
        .where(
            and(
                eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                eq(billingPlanPriceChangeTargets.status, 'deferred')
            )
        );
    const deferredCount = remainingDeferred?.n ?? 0;

    let done = false;
    if (shouldFinalize({ pendingCount, deferredCount, newSubsFound })) {
        // Finalize: `failed` if ANY target for this change went terminal-bad — either
        // `failed` (MP mutation gave up) OR `skipped` (could not be re-priced within
        // the defer budget; an honest partial failure) — else `done`. A finalized
        // header is no longer re-selected by findDueChanges (which filters
        // status IN ('pending','applying') for decreases / ('noticing','applying') for
        // increases).
        const [failed] = await db
            .select({ n: sql<number>`count(*)::int` })
            .from(billingPlanPriceChangeTargets)
            .where(
                and(
                    eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                    inArray(billingPlanPriceChangeTargets.status, ['failed', 'skipped'])
                )
            );
        const finalStatus = (failed?.n ?? 0) > 0 ? 'failed' : 'done';
        await db
            .update(billingPlanPriceChanges)
            .set({ status: finalStatus, updatedAt: now })
            .where(eq(billingPlanPriceChanges.id, change.id));
        done = true;
    }

    return { targetsApplied, targetsFailed, done };
}

/** Minimal logger shape used by the job internals. */
interface CronJobContextLogger {
    info: (m: string, d?: Record<string, unknown>) => void;
    warn: (m: string, d?: Record<string, unknown>) => void;
    error: (m: string, d?: Record<string, unknown>) => void;
}

/** Change row shape the notice phase needs (carries oldAmount for the notice copy). */
interface NoticeChangeRow {
    readonly id: string;
    readonly planId: string;
    readonly billingInterval: string;
    readonly oldAmount: number;
    readonly newAmount: number;
}

/**
 * Pending INCREASE changes that still need their advance notice sent
 * (`status='pending' AND notice_sent_at IS NULL`).
 */
async function findPendingIncreaseChangesToNotice(): Promise<NoticeChangeRow[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: billingPlanPriceChanges.id,
            planId: billingPlanPriceChanges.planId,
            billingInterval: billingPlanPriceChanges.billingInterval,
            oldAmount: billingPlanPriceChanges.oldAmount,
            newAmount: billingPlanPriceChanges.newAmount
        })
        .from(billingPlanPriceChanges)
        .where(
            and(
                eq(billingPlanPriceChanges.direction, 'increase'),
                eq(billingPlanPriceChanges.status, 'pending'),
                isNull(billingPlanPriceChanges.noticeSentAt)
            )
        )
        .orderBy(asc(billingPlanPriceChanges.createdAt))
        .limit(MAX_CHANGES_PER_TICK);
    return rows;
}

/** Outcome of one notice-phase pass. */
interface NoticePhaseOutcome {
    /** Number of changes flipped `pending` → `noticing` this tick. */
    readonly noticed: number;
    /** Number of advance notices successfully attempted (subscribers). */
    readonly notified: number;
}

/**
 * Increase NOTICE phase (HOS-176 Increment A, gated by the caller on the increase
 * flag). For each pending, not-yet-noticed increase change:
 *   1. Enumerate ALL affected subscribers (includes trialing — grandfathered at
 *      apply time but still legally notified) via {@link findAllAffectedSubscribers}.
 *   2. FAIL-CLOSED overflow guard (W1): if the enumeration returned `>=`
 *      {@link MAX_TARGETS_PER_CHANGE} rows there may be MORE affected subscribers
 *      beyond the per-tick cap that we cannot enumerate here. Emailing a subset and
 *      then flipping to `noticing` would re-price the un-notified overflow subs at
 *      apply time WITHOUT the legally-required advance notice (Disp. 954/2025 gap).
 *      So the change is NOT noticed and NOT sent this tick: it is left `pending`
 *      (never applied) and surfaced to ops for manual handling.
 *   3. Resolve the plan display name (best-effort).
 *   4. Send the advance notice to each subscriber. A subscriber whose CUSTOMER cannot be
 *      resolved (null) is a HARD failure (FIX A) — no notice can be produced and there is
 *      no retry path. A THROW from customer/plan resolution (or the send) is ALSO a HARD
 *      failure (FIX 1 / INFO-1): `sendNotification` never throws, so a throw here is
 *      practically only a resolution failure — the same "could not notify this sub" case.
 *      ANY per-sub notice failure (null OR throw) blocks the flip in step 5 (fail-closed,
 *      symmetric).
 *   5. Flip the change to `noticing`, stamp `noticeSentAt=now`, and recompute
 *      `effectiveAt = now + 15 days` — ONLY if no hard notice failure occurred. Once
 *      flipped it is never re-noticed (noticeSentAt non-null) and becomes due for apply
 *      only after the grace window.
 *
 * DELIVERY SEMANTICS — AT-LEAST-ONCE, NOT exactly-once (FIX B, honest correction). The
 * `idempotencyKey: price-notice:<changeId>:<subscriptionId>` passed to `sendNotification`
 * does NOT prevent a duplicate advance-notice EMAIL on replay: `NotificationService.send()`
 * sends the email BEFORE its idempotent `logNotification` insert (and swallows the
 * unique-index conflict), so the key dedups only the notification LOG rows, never the
 * delivery. A crash between the send loop and the `noticing` flip re-selects the
 * still-`pending` change next tick and MAY re-email subscribers. The only harm is a
 * duplicate advance notice (we never UNDER-send); exactly-once is a pre-enable follow-up
 * (see below, item 2). The key is kept because it is harmless and becomes effective if
 * `send()` ever gains pre-send dedup.
 *
 * SCALE LIMIT (v1): auto-increase is supported only for plans with FEWER than
 * {@link MAX_TARGETS_PER_CHANGE} affected subscribers — proof that a single tick can
 * enumerate and notify everyone. A plan at/above that scale requires a human to handle
 * the mass increase; a cross-tick paginated notice is a deliberate follow-up, NOT built
 * here (building it would risk emailing a subset and then not completing, which is the
 * exact partial-notice hazard this guard avoids).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * PRE-ENABLE FOLLOW-UP (before setting HOSPEDA_BILLING_PRICE_INCREASE_ENABLED=true in
 * ANY env). The increase flow is gated OFF by default; the items below MUST land before
 * the flag is ever enabled — they are not blockers for the off state, but are for the on
 * state:
 *   1. LEGAL NOTICE COPY (D-3): replace the `TODO(HOS-176 D-3)` placeholder notice copy
 *      with the final, legally-reviewed advance-notice wording.
 *   2. PER-SUBSCRIBER NOTICE-TARGET PERSISTENCE (robust replacement for FIX A + FIX B's
 *      stop-gaps): at notice time, persist a `notified` marker/target per successfully-
 *      notified sub. The notice phase then EXCLUDES already-notified subs (exactly-once —
 *      closes the crash-replay duplicate-email window), and the increase APPLY sources
 *      ONLY `notified` subs (closes the customer-not-found / retry-exhaustion notice→apply
 *      gap and the notice-set vs apply-set divergence that FIX A only narrowly patches by
 *      blocking the flip).
 *   3. CROSS-TICK PAGINATED NOTICE for plans with >= {@link MAX_TARGETS_PER_CHANGE}
 *      affected subscribers (today those fail closed to manual handling — see SCALE
 *      LIMIT above).
 *   4. A STAGING SMOKE of the full increase flow (notice → grace → apply) against the
 *      real MP sandbox before enabling the flag in any environment.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Best-effort throughout: never throws to the caller (the caller also wraps it).
 */
async function runIncreaseNoticePhase(
    billing: QZPayBilling,
    logger: CronJobContextLogger
): Promise<NoticePhaseOutcome> {
    const db = getDb();
    let noticed = 0;
    let notified = 0;

    const changes = await findPendingIncreaseChangesToNotice();
    for (const change of changes) {
        const now = new Date();
        const effectiveAt = new Date(now.getTime() + INCREASE_NOTICE_GRACE_MS);

        // Enumerate affected subs FIRST so the overflow guard can bail before we send
        // any notice or resolve the plan name.
        const subs = await findAllAffectedSubscribers(change.planId, change.billingInterval, [
            ...AFFECTED_SUB_STATUSES
        ]);

        // W1 FAIL-CLOSED overflow guard: the enumeration is capped at
        // MAX_TARGETS_PER_CHANGE. `>=` the cap means there may be un-enumerable overflow
        // subscribers, so notifying a subset then flipping to `noticing` would apply an
        // increase to the overflow without the mandatory advance notice. Detect this
        // BEFORE sending anything and bail: leave the change `pending` (noticeSentAt
        // stays NULL, so it is never applied) and surface it for manual handling.
        if (subs.length >= MAX_TARGETS_PER_CHANGE) {
            Sentry.captureException(
                new Error(
                    `HOS-176: plan price INCREASE on plan ${change.planId}/${change.billingInterval} affects >= ${MAX_TARGETS_PER_CHANGE} subscribers — auto-notice not supported at this scale; manual handling required. Change ${change.id} left pending, NOT applied.`
                ),
                {
                    extra: {
                        priceChangeId: change.id,
                        planId: change.planId,
                        billingInterval: change.billingInterval
                    },
                    tags: { module: 'propagate-plan-price-changes' }
                }
            );
            logger.error(
                'Price propagation notice: increase affects >= per-tick cap subscribers — auto-notice unsupported at this scale; change left pending for manual handling (NOT applied)',
                {
                    priceChangeId: change.id,
                    planId: change.planId,
                    billingInterval: change.billingInterval,
                    cap: MAX_TARGETS_PER_CHANGE
                }
            );
            continue;
        }

        // Resolve the plan display name once (best-effort — falls back to the plan id).
        let planName = change.planId;
        try {
            const plan = await billing.plans.get(change.planId);
            if (plan) planName = planDisplayNameFromPlan(plan);
        } catch (planErr) {
            logger.warn('Price propagation notice: could not resolve plan name', {
                priceChangeId: change.id,
                planId: change.planId,
                error: planErr instanceof Error ? planErr.message : String(planErr)
            });
        }

        // FIX A: a HARD notice failure (a sub whose customer cannot be resolved — no
        // notice can be produced and there is NO retry path for it) must block the flip
        // to `noticing`. Flipping anyway would make this un-noticed sub due for apply in
        // 15 days and re-price it WITHOUT the legally-required advance notice (Disp.
        // 954/2025). Only customer-not-found sets this flag; a transient `sendNotification`
        // throw does NOT (RetryService re-enqueues those out-of-band, so they will be
        // retried — see the catch below).
        let hadHardNoticeFailure = false;
        for (const sub of subs) {
            try {
                const customer = await billing.customers.get(sub.customerId);
                if (!customer) {
                    // HARD failure: the customer is unresolvable, so no notice can be
                    // sent and there is no out-of-band retry that will fix it. Do NOT flip
                    // this change to `noticing` — leave it `pending` so `findDueChanges`
                    // never applies it, and re-surface it every tick until ops fixes the
                    // data anomaly. HONEST CONSEQUENCE (INFO-2): leaving the change
                    // `pending` is NOT just internal Sentry noise. While it stays stranded,
                    // EACH cron tick re-enumerates this change and RE-EMAILS every
                    // already-resolvable subscriber on it (customer-facing at-least-once
                    // amplification, since there is no per-sub `notified` marker yet), and
                    // keeps doing so until ops repairs the unresolvable customer. Pre-enable
                    // follow-up item 2 (per-subscriber notice-target persistence) is what
                    // eliminates this re-email amplification.
                    hadHardNoticeFailure = true;
                    Sentry.captureException(
                        new Error(
                            `HOS-176: increase notice could not resolve customer for subscription ${sub.subscriptionId} on change ${change.id} — leaving change pending, NOT flipping to noticing`
                        ),
                        {
                            extra: {
                                priceChangeId: change.id,
                                subscriptionId: sub.subscriptionId,
                                customerId: sub.customerId
                            },
                            tags: { module: 'propagate-plan-price-changes' }
                        }
                    );
                    logger.error(
                        'Price propagation notice: customer not found — HARD failure, change will NOT flip to noticing',
                        {
                            priceChangeId: change.id,
                            subscriptionId: sub.subscriptionId,
                            customerId: sub.customerId
                        }
                    );
                    continue;
                }
                const meta = customer.metadata as Record<string, unknown> | null | undefined;
                const customerName = String(meta?.name ?? customer.email);
                await sendNotification({
                    type: NotificationType.PLAN_PRICE_CHANGE_NOTICE,
                    recipientEmail: customer.email,
                    recipientName: customerName,
                    userId: meta?.userId == null ? null : String(meta.userId),
                    customerId: sub.customerId,
                    // AT-LEAST-ONCE (see FIX B / method docstring): this key does NOT
                    // prevent a duplicate email on replay — NotificationService sends
                    // BEFORE the idempotent log insert, so the key only dedups the
                    // notification LOG rows, never the delivery. Kept because it is
                    // harmless and becomes effective if send() ever gains pre-send dedup.
                    idempotencyKey: `price-notice:${change.id}:${sub.subscriptionId}`,
                    planName,
                    oldPriceArs: change.oldAmount,
                    newPriceArs: change.newAmount,
                    effectiveDate: effectiveAt.toISOString(),
                    billingInterval: change.billingInterval
                });
                notified += 1;
            } catch (sendErr) {
                // HARD failure (FIX 1 / INFO-1), symmetric with the customer-not-found
                // null case above. `sendNotification` / NotificationService.send() NEVER
                // throw (they swallow + retry out-of-band), so a throw here is practically
                // only a customer/plan resolution failure — i.e. "we could not notify this
                // sub", exactly the same hard failure as the null case. Flipping to
                // `noticing` anyway would make this un-noticed sub due for apply in 15 days
                // WITHOUT the legally-required advance notice (Disp. 954/2025). So set the
                // flag and block the flip (fail-closed). This is safe: a transient throw
                // just leaves the change `pending` and it is retried next tick.
                hadHardNoticeFailure = true;
                Sentry.captureException(
                    new Error(
                        `HOS-176: increase notice threw resolving/sending for subscription ${sub.subscriptionId} on change ${change.id} — leaving change pending, NOT flipping to noticing`
                    ),
                    {
                        extra: { priceChangeId: change.id, subscriptionId: sub.subscriptionId },
                        tags: { module: 'propagate-plan-price-changes' }
                    }
                );
                logger.warn(
                    'Price propagation notice: notice threw (HARD failure — change left pending, NOT flipped to noticing)',
                    {
                        priceChangeId: change.id,
                        subscriptionId: sub.subscriptionId,
                        error: sendErr instanceof Error ? sendErr.message : String(sendErr)
                    }
                );
            }
        }

        if (hadHardNoticeFailure) {
            // At least one affected sub could not be notified (unresolvable customer).
            // Leave the change `pending` (noticeSentAt NULL) so it is never applied
            // without a complete advance notice; it is retried next tick.
            logger.error(
                'Price propagation notice: change left pending — at least one affected subscriber has an unresolvable customer; NOT flipped to noticing (will retry next tick)',
                {
                    priceChangeId: change.id,
                    planId: change.planId,
                    billingInterval: change.billingInterval,
                    subscribersFound: subs.length
                }
            );
            continue;
        }

        await db
            .update(billingPlanPriceChanges)
            .set({ status: 'noticing', noticeSentAt: now, effectiveAt, updatedAt: now })
            .where(eq(billingPlanPriceChanges.id, change.id));
        noticed += 1;
        logger.info('Price propagation notice: change moved to noticing', {
            priceChangeId: change.id,
            planId: change.planId,
            subscribersFound: subs.length,
            effectiveAt: effectiveAt.toISOString()
        });
    }

    return { noticed, notified };
}

/**
 * Cron job definition — registered in `apps/api/src/cron/registry.ts`.
 */
export const propagatePlanPriceChangesJob: CronJobDefinition = {
    name: 'propagate-plan-price-changes',
    description:
        'Propagate admin plan price changes to existing subscribers’ MP preapprovals (HOS-176). Decreases apply immediately; increases run the Disp. 954/2025 advance-notice + 15-day grace flow behind HOSPEDA_BILLING_PRICE_INCREASE_ENABLED (off by default).',
    schedule: '*/15 * * * *',
    enabled: true,
    timeoutMs: 5 * 60_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        const billing = getQZPayBilling();
        if (!billing) {
            logger.warn('propagate-plan-price-changes: billing not configured, skipping');
            return {
                success: true,
                message: 'Skipped — billing not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startMs
            };
        }

        // Increase path is gated: when the flag is off, increases never get a notice
        // and are never returned as due — they stay `pending`, exactly as before.
        const increaseEnabled = env.HOSPEDA_BILLING_PRICE_INCREASE_ENABLED;

        // Notice phase (increase only, gated). Best-effort: a failure here must not
        // block decrease propagation, so it is wrapped and only logged. Skipped in
        // dry-run (it sends real emails + flips rows).
        if (increaseEnabled && !dryRun) {
            try {
                const noticeOutcome = await runIncreaseNoticePhase(billing, logger);
                if (noticeOutcome.noticed > 0) {
                    logger.info('propagate-plan-price-changes: increase notice phase complete', {
                        changesNoticed: noticeOutcome.noticed,
                        subscribersNotified: noticeOutcome.notified
                    });
                }
            } catch (noticeErr) {
                logger.error('propagate-plan-price-changes: increase notice phase failed', {
                    error: noticeErr instanceof Error ? noticeErr.message : String(noticeErr)
                });
            }
        }

        let due: DueChangeRow[];
        try {
            due = await findDueChanges({ increaseEnabled });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('propagate-plan-price-changes: due-query failed', { error: message });
            return {
                success: false,
                message: `Due-query failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }

        if (dryRun) {
            return {
                success: true,
                message: `Dry run — ${due.length} price change(s) would be propagated`,
                processed: due.length,
                errors: 0,
                durationMs: Date.now() - startMs,
                details: { ids: due.map((c) => c.id), increaseEnabled }
            };
        }

        let changesDone = 0;
        let totalApplied = 0;
        let totalFailed = 0;

        for (const change of due) {
            try {
                const outcome = await applyChange(change, billing, logger);
                totalApplied += outcome.targetsApplied;
                totalFailed += outcome.targetsFailed;
                if (outcome.done) changesDone += 1;
            } catch (err) {
                totalFailed += 1;
                logger.error('propagate-plan-price-changes: unexpected error applying change', {
                    priceChangeId: change.id,
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        }

        return {
            success: totalFailed === 0,
            message: `Propagated ${totalApplied} target(s) across ${due.length} change(s); ${changesDone} completed, ${totalFailed} failed`,
            processed: totalApplied + totalFailed,
            errors: totalFailed,
            durationMs: Date.now() - startMs,
            details: { due: due.length, changesDone, totalApplied, totalFailed }
        };
    }
};

/** Internals exposed for unit tests only. */
export const _internals = {
    MAX_CHANGES_PER_TICK,
    MAX_TARGETS_PER_CHANGE,
    MP_UPDATE_MAX_ATTEMPTS,
    MAX_TARGET_TICK_ATTEMPTS,
    MP_MAX_TRANSACTION_AMOUNT_ARS,
    INCREASE_NOTICE_GRACE_MS,
    resolveDiscountAwareTargetCentavos,
    nextTargetStatusOnFailure,
    nextDeferStatus,
    shouldFinalize,
    affectedStatusesForDirection,
    classifyTargetAmountGuard,
    findDueChanges,
    findAffectedSubscribers,
    findAllAffectedSubscribers,
    findPendingIncreaseChangesToNotice,
    runIncreaseNoticePhase,
    ensureTargets,
    applyMpAmount,
    applyChange
};
