/**
 * Propagate Plan Price Changes Cron Job (HOS-176).
 *
 * Applies enqueued `billing_plan_price_changes` (written by `updatePlan` when an
 * admin edits a plan's price) to each affected subscriber's MercadoPago preapproval,
 * so MP stops charging the stale amount. Fires every 15 minutes.
 *
 * SCOPE (this increment): **DECREASES ONLY.** A price decrease is frictionless — no
 * legal notice, no chargeback risk, and it only ever lowers `transaction_amount`
 * from/to a value at or below what the subscriber authorized (the proven-safe
 * direction, spike §3.2). INCREASES are deliberately NOT processed here: they are
 * gated on the owner's MP sandbox re-auth smoke (spike G-1) and require prior notice
 * + a grace window (Disp. 954/2025, owner decision D-3). Increase rows stay `pending`
 * until the gated increase executor + notice flow are enabled in a follow-up.
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
    lte,
    sql
} from '@repo/db';
import {
    calculatePromoCodeEffect,
    getPromoCodeById,
    loadSubscriptionDiscountState
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../middlewares/billing.js';
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

/** Subscription statuses whose preapproval we re-price (live, chargeable subs). */
const AFFECTED_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const;

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

/** Load due DECREASE price changes (effectiveAt elapsed, not yet done/failed). */
async function findDueDecreaseChanges(): Promise<DueChangeRow[]> {
    const db = getDb();
    const rows = await db
        .select({
            id: billingPlanPriceChanges.id,
            planId: billingPlanPriceChanges.planId,
            billingInterval: billingPlanPriceChanges.billingInterval,
            newAmount: billingPlanPriceChanges.newAmount,
            direction: billingPlanPriceChanges.direction
        })
        .from(billingPlanPriceChanges)
        .where(
            and(
                eq(billingPlanPriceChanges.direction, 'decrease'),
                inArray(billingPlanPriceChanges.status, ['pending', 'applying']),
                lte(billingPlanPriceChanges.effectiveAt, new Date())
            )
        )
        // Apply oldest-effective first (tie-break by creation) so concurrent
        // decreases converge deterministically to the newest amount (W2).
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
    changeId: string
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
                inArray(billingSubscriptions.status, [...AFFECTED_SUB_STATUSES]),
                isNotNull(billingSubscriptions.mpSubscriptionId),
                sql`NOT EXISTS (SELECT 1 FROM ${billingPlanPriceChangeTargets} t WHERE t.price_change_id = ${changeId} AND t.subscription_id = ${billingSubscriptions.id})`
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

/** Apply one due decrease change: create targets, mutate pending ones, finalize. */
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

    const subs = await findAffectedSubscribers(change.planId, change.billingInterval, change.id);
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
        // header is no longer re-selected by findDueDecreaseChanges (which filters
        // status IN ('pending','applying')).
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

/**
 * Cron job definition — registered in `apps/api/src/cron/registry.ts`.
 */
export const propagatePlanPriceChangesJob: CronJobDefinition = {
    name: 'propagate-plan-price-changes',
    description:
        'Propagate admin plan price DECREASES to existing subscribers’ MP preapprovals (HOS-176). Increases are gated on the owner re-auth smoke + notice flow.',
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

        let due: DueChangeRow[];
        try {
            due = await findDueDecreaseChanges();
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
                message: `Dry run — ${due.length} decrease change(s) would be propagated`,
                processed: due.length,
                errors: 0,
                durationMs: Date.now() - startMs,
                details: { ids: due.map((c) => c.id) }
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
    resolveDiscountAwareTargetCentavos,
    nextTargetStatusOnFailure,
    nextDeferStatus,
    shouldFinalize,
    findDueDecreaseChanges,
    findAffectedSubscribers,
    ensureTargets,
    applyMpAmount,
    applyChange
};
