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
 * no MP mutation). The increase path is NOTICE-LEDGER-BACKED (item b): the notice phase
 * persists a per-subscriber `billing_plan_price_change_notices` row on each successful
 * send (exactly-once), and the apply sources subscribers ONLY from that ledger — never a
 * fresh live enumeration — so the apply-set can never diverge from the notice-set (a sub
 * is re-priced iff it was legally notified). Two owner decisions shape the increase apply:
 *   - Grace window = 15 days (owner decision).
 *   - Trialing subs are GRANDFATHERED: they receive the notice but keep the OLD price
 *     through their in-flight trial, so at apply time a notified sub that is trialing (or
 *     no longer live) gets NO target — it is skipped without failing the change (decreases
 *     still include trialing subs — lowering a trialing sub is fine).
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
    billingPlanPriceChangeNotices,
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

/**
 * (INCREASE only) Create targets for the notified-but-not-yet-targeted subscribers of a
 * change, sourced ONLY from the {@link billingPlanPriceChangeNotices} ledger (HOS-176
 * item b). This is what closes the notice-set vs apply-set divergence: an increase
 * re-prices a subscriber iff that subscriber has a notice-ledger row (was legally
 * notified), never a freshly-enumerated live sub.
 *
 * For each ledger sub WITHOUT a target row yet:
 *   - CURRENT status NOT in {@link INCREASE_AFFECTED_SUB_STATUSES} — trialing
 *     (grandfathered D-4: kept at the OLD amount through the trial) OR no longer
 *     chargeable (cancelled/paused/…): NO target is created. The notice row remains the
 *     permanent record; the sub keeps its OLD amount and does NOT fail the change. A
 *     trialing sub that later converts to `active` is picked up on a subsequent tick
 *     (its status now qualifies), so a mid-grace conversion is still re-priced.
 *   - `active` / `past_due`: resolve the discount-aware amount and insert a `pending`
 *     (or `deferred`, when the amount is not yet determinable) target, snapshotting the
 *     CURRENT `mpSubscriptionId`.
 *
 * Idempotent: the `NOT EXISTS` filter + `ON CONFLICT DO NOTHING` mean re-running never
 * duplicates a target. Because the notice ledger is a fixed, sub-cap set (the notice
 * phase's overflow guard keeps it below {@link MAX_TARGETS_PER_CHANGE}), every qualifying
 * sub is targeted on the first apply tick — there is no cross-tick batching here.
 *
 * @internal
 */
async function ensureTargetsFromNotices(
    change: DueChangeRow,
    logger: CronJobContextLogger
): Promise<void> {
    const db = getDb();
    // 1. The notice ledger for this change (the ONLY source of apply-eligible subs).
    const notices = await db
        .select({ subscriptionId: billingPlanPriceChangeNotices.subscriptionId })
        .from(billingPlanPriceChangeNotices)
        .where(eq(billingPlanPriceChangeNotices.priceChangeId, change.id))
        .limit(MAX_TARGETS_PER_CHANGE);
    if (notices.length === 0) return;

    // 2. Subs already targeted for this change (skip — idempotent, mirrors the
    //    ensureTargets NOT-EXISTS filter without a fresh live enumeration).
    const targeted = await db
        .select({ subscriptionId: billingPlanPriceChangeTargets.subscriptionId })
        .from(billingPlanPriceChangeTargets)
        .where(eq(billingPlanPriceChangeTargets.priceChangeId, change.id));
    const targetedSet = new Set(targeted.map((r) => r.subscriptionId));
    const candidateIds = notices.map((n) => n.subscriptionId).filter((id) => !targetedSet.has(id));
    if (candidateIds.length === 0) return;

    // 3. CURRENT state of the notified-but-not-yet-targeted subs (status decides the
    //    grandfather; mpSubscriptionId is snapshotted onto the target).
    const subs = await db
        .select({
            id: billingSubscriptions.id,
            status: billingSubscriptions.status,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId
        })
        .from(billingSubscriptions)
        .where(inArray(billingSubscriptions.id, candidateIds));

    const chargeableStatuses = INCREASE_AFFECTED_SUB_STATUSES as readonly string[];
    for (const sub of subs) {
        // Grandfather (D-4): only active / past_due notified subs are re-priced on an
        // increase. A trialing (or no-longer-live) notified sub gets NO target — its
        // notice ledger row is the permanent record and it keeps the OLD amount, without
        // failing the change. NEVER resolve a discount / call MP for a grandfathered sub.
        if (!chargeableStatuses.includes(sub.status)) {
            continue;
        }
        const resolution = await resolveDiscountAwareTargetCentavos(sub.id, change.newAmount);
        const deferred = 'defer' in resolution;
        if (deferred) {
            // Amount undeterminable this tick — persist a `deferred` target (placeholder
            // amount, not used while deferred); re-resolved by applyChange under a bounded
            // budget (mirrors ensureTargets).
            logger.info('Price propagation: deferring subscriber (amount undetermined)', {
                priceChangeId: change.id,
                subscriptionId: sub.id
            });
        }
        await db
            .insert(billingPlanPriceChangeTargets)
            .values({
                priceChangeId: change.id,
                subscriptionId: sub.id,
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

    // Target sourcing is direction-asymmetric (HOS-176 item b):
    //   - INCREASE sources subscribers ONLY from the notice ledger
    //     ({@link ensureTargetsFromNotices}) — never a fresh live enumeration — so the
    //     apply-set can never diverge from the notice-set (a sub is re-priced iff it was
    //     legally notified). Trialing / no-longer-live notified subs are grandfathered
    //     there (no target). The ledger is a fixed, sub-cap set fully present once the
    //     change reached `noticing`, so there is NO cross-tick overflow batching:
    //     `newSubsFound` is 0 and finalization gates purely on pending/deferred drain.
    //   - DECREASE has no notice, so it enumerates affected subs live (trialing INCLUDED —
    //     lowering a trialing sub is harmless) and batches overflow across ticks (I1).
    let newSubsFound: number;
    if (change.direction === 'increase') {
        await ensureTargetsFromNotices(change, logger);
        newSubsFound = 0;
    } else {
        const subs = await findAffectedSubscribers(
            change.planId,
            change.billingInterval,
            change.id,
            affectedStatusesForDirection(change.direction)
        );
        await ensureTargets(change, subs, logger);
        // New (not-yet-targeted) subs found this tick. While > 0 the change is not
        // finalized — there may be more overflow subs to batch next tick (I1).
        newSubsFound = subs.length;
    }

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
 * Increase NOTICE phase (HOS-176 Increment A, gated by the caller on the increase flag).
 * For each pending, not-yet-fully-noticed increase change:
 *   1. Enumerate ALL affected subscribers (includes trialing — grandfathered at apply but
 *      still legally notified) via {@link findAllAffectedSubscribers}.
 *   2. FAIL-CLOSED overflow guard (W1): `>=` {@link MAX_TARGETS_PER_CHANGE} affected subs
 *      means possible un-enumerable overflow, so notifying a subset then flipping would
 *      apply an increase to the overflow WITHOUT the legally-required advance notice
 *      (Disp. 954/2025 gap). The change is NOT noticed this tick — left `pending` and
 *      surfaced to ops. (Cross-tick paginated notice = pre-enable follow-up item 3.)
 *   3. Resolve the plan display name (best-effort).
 *   4. Notify each affected sub that does NOT already have a NOTICE-LEDGER row for this
 *      change (exactly-once — see below). On a successful send, persist a
 *      {@link billingPlanPriceChangeNotices} row.
 *   5. Flip the change to `noticing` (stamp `noticeSentAt`, recompute `effectiveAt =
 *      now + 15 days`) ONLY when EVERY affected sub has a notice-ledger row. A single
 *      un-notified sub (customer-not-found / send throw) blocks the flip; the change stays
 *      `pending` and is retried next tick.
 *
 * EXACTLY-ONCE NOTICE-LEDGER (HOS-176 item b — replaces the old FIX A + FIX B stop-gaps).
 * The per-subscriber {@link billingPlanPriceChangeNotices} row is the durable marker of
 * "this sub was notified for this change":
 *   - The notify loop SKIPS any sub already in the ledger, so a retry tick re-notifies
 *     ONLY the still-missing subs — the old all-subs re-email storm (when one companion
 *     sub failed to resolve) is gone. The row is inserted AFTER a successful send, so the
 *     only residual duplicate window is a crash between one sub's send and its insert
 *     (per-sub, never all-subs); we never UNDER-send. The `idempotencyKey` on
 *     `sendNotification` only dedups notification LOG rows, not delivery — DELIVERY
 *     exactly-once now comes from this ledger's skip-if-present, not from that key.
 *   - The flip gate is "every affected sub has a ledger row", so a change can only advance
 *     to apply once the notice is provably complete (fail-closed, robust — no reliance on
 *     an in-memory failure flag).
 *   - The increase APPLY ({@link ensureTargetsFromNotices}) sources subscribers ONLY from
 *     this ledger, so the apply-set can never diverge from the notice-set and an
 *     unresolved-customer sub can never be re-priced without a notice.
 *
 * SCALE LIMIT (v1): auto-increase is supported only for plans with FEWER than
 * {@link MAX_TARGETS_PER_CHANGE} affected subscribers (step 2). A plan at/above that scale
 * requires a human; the cross-tick paginated notice that would lift this limit is a
 * deliberate pre-enable follow-up (item 3).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * PRE-ENABLE FOLLOW-UP (before setting HOSPEDA_BILLING_PRICE_INCREASE_ENABLED=true in ANY
 * env). The increase flow is gated OFF by default; the items below MUST land before the
 * flag is ever enabled:
 *   1. LEGAL NOTICE COPY (D-3): replace the `TODO(HOS-176 D-3)` placeholder notice copy
 *      with the final, legally-reviewed advance-notice wording.
 *   2. ✅ DONE (HOS-176 item b): per-subscriber notice-ledger persistence — this method +
 *      {@link billingPlanPriceChangeNotices} + {@link ensureTargetsFromNotices}. Closes
 *      the crash-replay duplicate-email window, the customer-not-found notice→apply gap,
 *      and the notice-set vs apply-set divergence in one mechanism.
 *   3. CROSS-TICK PAGINATED NOTICE for plans with >= {@link MAX_TARGETS_PER_CHANGE}
 *      affected subscribers (today those fail closed to manual handling — see SCALE LIMIT
 *      above). The notice-ledger makes this straightforward: drop the overflow guard and
 *      drain the affected set across ticks (each tick's ledger excludes already-noticed
 *      subs), flipping to `noticing` only once the ledger covers every affected sub.
 *   4. A STAGING SMOKE of the full increase flow (notice → grace → apply) against the real
 *      MP sandbox before enabling the flag in any environment.
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

        // ALL affected subscribers (incl. trialing — grandfathered at apply, still legally
        // notified). Capped at MAX_TARGETS_PER_CHANGE. Enumerated FIRST so the overflow
        // guard can bail before we send any notice or resolve the plan name.
        const affected = await findAllAffectedSubscribers(change.planId, change.billingInterval, [
            ...AFFECTED_SUB_STATUSES
        ]);

        // W1 FAIL-CLOSED overflow guard: `>=` the cap means there may be un-enumerable
        // overflow subscribers, so notifying a subset then flipping to `noticing` would
        // apply an increase to the overflow without the mandatory advance notice. Bail
        // before sending anything: leave the change `pending` (noticeSentAt stays NULL, so
        // it is never applied) and surface it for manual handling. (Cross-tick paginated
        // notice = pre-enable follow-up item 3.)
        if (affected.length >= MAX_TARGETS_PER_CHANGE) {
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

        // EXACTLY-ONCE (item b): skip subs already in the notice ledger for this change, so
        // a retry tick re-notifies ONLY the still-missing subs (no all-subs re-email storm).
        const existing = await db
            .select({ subscriptionId: billingPlanPriceChangeNotices.subscriptionId })
            .from(billingPlanPriceChangeNotices)
            .where(eq(billingPlanPriceChangeNotices.priceChangeId, change.id));
        const alreadyNoticed = new Set(existing.map((r) => r.subscriptionId));

        for (const sub of affected) {
            if (alreadyNoticed.has(sub.subscriptionId)) continue;
            try {
                const customer = await billing.customers.get(sub.customerId);
                if (!customer) {
                    // Unresolvable customer: no notice can be produced and there is no
                    // out-of-band retry that will fix it. Persist NO ledger row → the flip
                    // gate below refuses to advance this change (fail-closed) and the sub is
                    // retried next tick WITHOUT re-emailing the subs already in the ledger.
                    Sentry.captureException(
                        new Error(
                            `HOS-176: increase notice could not resolve customer for subscription ${sub.subscriptionId} on change ${change.id} — no ledger row written, change stays pending`
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
                        'Price propagation notice: customer not found — no ledger row, change stays pending (retried next tick)',
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
                    // idempotencyKey only dedups notification LOG rows, not delivery (send
                    // happens before the idempotent log insert). DELIVERY exactly-once is
                    // provided by the notice ledger below (skip-if-present), not by this key;
                    // kept because it is harmless.
                    idempotencyKey: `price-notice:${change.id}:${sub.subscriptionId}`,
                    planName,
                    oldPriceArs: change.oldAmount,
                    newPriceArs: change.newAmount,
                    effectiveDate: effectiveAt.toISOString(),
                    billingInterval: change.billingInterval
                });
                // Persist the notice AFTER a successful send (idempotent). Send-then-insert
                // means the only residual duplicate window is a crash between THIS sub's send
                // and its insert — per-sub, never all-subs — and we never UNDER-send.
                await db
                    .insert(billingPlanPriceChangeNotices)
                    .values({
                        priceChangeId: change.id,
                        subscriptionId: sub.subscriptionId,
                        customerId: sub.customerId,
                        notifiedAt: now
                    })
                    .onConflictDoNothing({
                        target: [
                            billingPlanPriceChangeNotices.priceChangeId,
                            billingPlanPriceChangeNotices.subscriptionId
                        ]
                    });
                notified += 1;
            } catch (sendErr) {
                // `sendNotification` never throws (swallows + retries out-of-band), so a
                // throw here is practically a customer/plan resolution failure — "could not
                // notify this sub". Persist NO ledger row → same fail-closed handling as the
                // customer-not-found case: the flip gate refuses to advance; retried next tick.
                Sentry.captureException(
                    new Error(
                        `HOS-176: increase notice threw resolving/sending for subscription ${sub.subscriptionId} on change ${change.id} — no ledger row written, change stays pending`
                    ),
                    {
                        extra: { priceChangeId: change.id, subscriptionId: sub.subscriptionId },
                        tags: { module: 'propagate-plan-price-changes' }
                    }
                );
                logger.warn(
                    'Price propagation notice: notice threw (no ledger row — change stays pending, retried next tick)',
                    {
                        priceChangeId: change.id,
                        subscriptionId: sub.subscriptionId,
                        error: sendErr instanceof Error ? sendErr.message : String(sendErr)
                    }
                );
            }
        }

        // FLIP GATE (fail-closed, robust): advance to `noticing` ONLY when EVERY affected
        // sub has a notice-ledger row. Re-query the ledger (includes rows inserted this
        // tick). A single un-notified sub blocks the flip; the change stays `pending` so it
        // is never applied without a complete advance notice, and is retried next tick.
        const ledger = await db
            .select({ subscriptionId: billingPlanPriceChangeNotices.subscriptionId })
            .from(billingPlanPriceChangeNotices)
            .where(eq(billingPlanPriceChangeNotices.priceChangeId, change.id));
        const ledgerSet = new Set(ledger.map((r) => r.subscriptionId));
        const allNoticed = affected.every((a) => ledgerSet.has(a.subscriptionId));

        if (!allNoticed) {
            logger.error(
                'Price propagation notice: change left pending — at least one affected subscriber could not be notified; NOT flipped to noticing (retried next tick, already-noticed subs excluded)',
                {
                    priceChangeId: change.id,
                    planId: change.planId,
                    billingInterval: change.billingInterval,
                    affected: affected.length,
                    noticed: ledgerSet.size
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
            subscribersFound: affected.length,
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
    ensureTargetsFromNotices,
    applyMpAmount,
    applyChange
};
