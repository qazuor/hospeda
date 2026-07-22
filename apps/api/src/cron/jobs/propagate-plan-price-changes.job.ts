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
 *   - The change flips to `done` only when every target is `applied`.
 *
 * Discount-awareness (mandatory, spike §4.4): a subscriber with an active multi-cycle
 * discount must be re-priced to the DISCOUNTED amount on the NEW price, never the raw
 * new full price — otherwise the cron would clobber a live discount.
 *
 * @module cron/jobs/propagate-plan-price-changes
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import {
    and,
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

/** Hard cap on subscriber targets mutated per change per tick. */
const MAX_TARGETS_PER_CHANGE = 500;

/** Subscription statuses whose preapproval we re-price (live, chargeable subs). */
const AFFECTED_SUB_STATUSES = ['active', 'trialing', 'past_due'] as const;

/** Bounded retries for the best-effort MP amount mutation, per target per tick. */
const MP_UPDATE_MAX_ATTEMPTS = 3;
const MP_UPDATE_RETRY_DELAY_MS = 400;

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

/**
 * Resolve the discount-aware target amount (integer centavos) for a subscription
 * given the new full price. Mirrors `resolveDiscountAwarePlanChangeAmount`
 * (apply-scheduled-plan-changes) but uses the enqueued `newAmount` as the base, so
 * it never depends on the interval-ambiguous `resolveFullPlanPriceCentavos`.
 *
 * Fail-open: if the discount state can't be resolved, fall back to the full new
 * price. A missed discount re-application is recoverable; over-charging is not the
 * concern here (this is a DECREASE path, so the fallback only ever charges MORE than
 * a discount would — never more than the plan price the subscriber sees).
 *
 * @internal
 */
async function resolveDiscountAwareTargetCentavos(
    subscriptionId: string,
    newFullCentavos: number
): Promise<number> {
    try {
        const discountState = await loadSubscriptionDiscountState({ subscriptionId });
        if (!discountState?.promoCodeId) {
            return newFullCentavos;
        }
        const remaining = discountState.promoEffectRemainingCycles;
        // Active when remaining > 0 (finite) OR null (forever).
        if (remaining !== null && remaining <= 0) {
            return newFullCentavos;
        }
        const promoResult = await getPromoCodeById(discountState.promoCodeId);
        if (!promoResult.success || !promoResult.data?.effect) {
            return newFullCentavos;
        }
        const mutation = calculatePromoCodeEffect(promoResult.data.effect, newFullCentavos);
        if (mutation.type !== 'apply-discount') {
            return newFullCentavos;
        }
        return mutation.finalAmount;
    } catch (err) {
        Sentry.captureException(
            new Error(
                `HOS-176: discount-aware target resolution failed: ${
                    err instanceof Error ? err.message : String(err)
                }`
            ),
            { extra: { subscriptionId }, tags: { module: 'propagate-plan-price-changes' } }
        );
        return newFullCentavos;
    }
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
        .limit(MAX_CHANGES_PER_TICK);
    return rows;
}

/** Current live subscribers on a plan+interval carrying an MP preapproval. */
async function findAffectedSubscribers(
    planId: string,
    billingInterval: string
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
                isNotNull(billingSubscriptions.mpSubscriptionId)
            )
        )
        .limit(MAX_TARGETS_PER_CHANGE);
    return rows;
}

/** Create (idempotently) a target row per affected subscriber for this change. */
async function ensureTargets(change: DueChangeRow, subs: AffectedSubRow[]): Promise<void> {
    if (subs.length === 0) return;
    const db = getDb();
    for (const sub of subs) {
        const targetAmount = await resolveDiscountAwareTargetCentavos(
            sub.subscriptionId,
            change.newAmount
        );
        await db
            .insert(billingPlanPriceChangeTargets)
            .values({
                priceChangeId: change.id,
                subscriptionId: sub.subscriptionId,
                mpSubscriptionId: sub.mpSubscriptionId,
                targetAmount,
                status: 'pending'
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

    // Mark applying (idempotent; also takes 'pending' → 'applying').
    await db
        .update(billingPlanPriceChanges)
        .set({ status: 'applying', updatedAt: new Date() })
        .where(eq(billingPlanPriceChanges.id, change.id));

    const subs = await findAffectedSubscribers(change.planId, change.billingInterval);
    await ensureTargets(change, subs);

    // Load pending targets for this change and mutate each.
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
    const now = new Date();

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
            await db
                .update(billingPlanPriceChangeTargets)
                .set({
                    attemptCount: t.attemptCount + 1,
                    lastError: result.error,
                    lastAttemptAt: now,
                    updatedAt: now
                })
                .where(eq(billingPlanPriceChangeTargets.id, t.id));
            targetsFailed += 1;
            logger.warn('Price propagation: MP amount update failed (will retry next tick)', {
                priceChangeId: change.id,
                subscriptionId: t.subscriptionId,
                error: result.error
            });
        }
    }

    // The change is done when no pending targets remain.
    const [remaining] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(billingPlanPriceChangeTargets)
        .where(
            and(
                eq(billingPlanPriceChangeTargets.priceChangeId, change.id),
                eq(billingPlanPriceChangeTargets.status, 'pending')
            )
        );
    const done = (remaining?.n ?? 0) === 0;
    if (done) {
        await db
            .update(billingPlanPriceChanges)
            .set({ status: 'done', updatedAt: now })
            .where(eq(billingPlanPriceChanges.id, change.id));
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
    resolveDiscountAwareTargetCentavos,
    findDueDecreaseChanges,
    findAffectedSubscribers,
    ensureTargets,
    applyMpAmount,
    applyChange
};
