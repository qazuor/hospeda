/**
 * Apply Scheduled Plan Changes Cron Job (SPEC-141 D7 downgrade).
 *
 * Fires every 15 minutes and applies any subscription whose
 * `scheduledPlanChange.status === 'pending'` and
 * `scheduledPlanChange.applyAt <= now()` — typically downgrades
 * queued by the plan-change route to take effect at
 * `currentPeriodEnd`.
 *
 * The apply sequence mirrors what the legacy synchronous downgrade
 * branch used to do at request time, just deferred:
 *   1. `billing.subscriptions.changePlan(...)` — flips local planId.
 *   2. `paymentAdapter.subscriptions.update(...)` — propagates the
 *      new recurring amount to MP — best-effort, logged on failure.
 *   3. `handlePlanChangeAddonRecalculation(...)` — refreshes addon
 *      limits — best-effort.
 *   4. `clearEntitlementCache(customerId)` — flips entitlements to
 *      the new plan in the running process.
 *   5. Mark the scheduledPlanChange as `applied` with `resolvedAt`.
 *
 * Failures:
 *   - Step 1 throws → increment `attemptCount`, set `lastAttemptAt`
 *     + `lastError`, keep status `pending`. After
 *     `MAX_APPLY_ATTEMPTS` failures the change flips to `failed`
 *     and the cron stops retrying — ops needs to intervene
 *     (Sentry alert via `apiLogger.error`).
 *   - Steps 2–4 fail → logged, the plan change is still considered
 *     applied (the local change already succeeded, the webhook
 *     reconciliation path eventually fixes MP drift).
 *
 * @module cron/jobs/apply-scheduled-plan-changes
 */

import type { QZPayBilling, QZPayScheduledPlanChange } from '@qazuor/qzpay-core';
import { billingSubscriptions, getDb, sql } from '@repo/db';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { handlePlanChangeAddonRecalculation } from '../../services/addon-plan-change.service.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * Hard cap on attempts before flipping a scheduled change to
 * `failed`. The cron runs every 15 minutes, so 5 attempts buys
 * ~1 hour of automatic recovery before paging ops.
 */
const MAX_APPLY_ATTEMPTS = 5;

/**
 * Soft cap on rows processed per tick. Plan changes are rare events
 * (one per user lifetime is the norm) so the realistic batch is 0-1
 * — the cap is a safety valve against runaway runs from a buggy
 * write.
 */
const MAX_ROWS_PER_TICK = 100;

/**
 * Minimal row shape the cron needs from the subscription. Drops the
 * fields the apply step doesn't use to keep the SELECT cheap and the
 * type narrow.
 */
interface PendingPlanChangeRow {
    readonly subscriptionId: string;
    readonly customerId: string;
    readonly currentPlanId: string;
    readonly mpSubscriptionId: string | null;
    readonly scheduledPlanChange: QZPayScheduledPlanChange;
}

/**
 * Outcome of attempting to apply one scheduled change. Returned by
 * `applyOne` and aggregated by the cron handler for the
 * CronJobResult.
 */
type ApplyOutcome =
    | { kind: 'applied' }
    | { kind: 'retry'; attemptCount: number; error: string }
    | { kind: 'failed'; attemptCount: number; error: string };

/**
 * Load all pending scheduled plan changes whose `applyAt` is due.
 * Uses the partial index `idx_subscriptions_pending_plan_change` so
 * the per-tick cost stays at O(k) where k = #pending changes due.
 */
async function findDueScheduledChanges(): Promise<PendingPlanChangeRow[]> {
    const db = getDb();
    const rows = await db
        .select({
            subscriptionId: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            currentPlanId: billingSubscriptions.planId,
            mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
            scheduledPlanChange: billingSubscriptions.scheduledPlanChange
        })
        .from(billingSubscriptions)
        .where(
            sql`scheduled_plan_change IS NOT NULL
                AND (scheduled_plan_change->>'status') = 'pending'
                AND (scheduled_plan_change->>'applyAt')::timestamptz <= now()`
        )
        .limit(MAX_ROWS_PER_TICK);

    return rows.map((r) => ({
        subscriptionId: r.subscriptionId,
        customerId: r.customerId,
        currentPlanId: r.currentPlanId,
        mpSubscriptionId: r.mpSubscriptionId,
        scheduledPlanChange: r.scheduledPlanChange as QZPayScheduledPlanChange
    }));
}

/**
 * Apply a single scheduled change end-to-end. Returns a discriminated
 * `ApplyOutcome` so the caller knows whether the row should be
 * retried, marked applied, or marked failed.
 *
 * Step 1 (`changePlan`) is the only step whose failure causes a
 * retry — without the planId flip nothing else makes sense. Steps
 * 2-4 (MP propagate / addon recalc / cache clear) failing are
 * logged but do NOT trigger a retry, because the local change
 * already succeeded.
 */
async function applyOne(
    row: PendingPlanChangeRow,
    billing: QZPayBilling,
    logger: {
        info: (m: string, d?: Record<string, unknown>) => void;
        warn: (m: string, d?: Record<string, unknown>) => void;
        error: (m: string, d?: Record<string, unknown>) => void;
    }
): Promise<ApplyOutcome> {
    const { subscriptionId, customerId, currentPlanId, mpSubscriptionId, scheduledPlanChange } =
        row;
    const { newPlanId, newPriceId, targetTransactionAmountMajor } = scheduledPlanChange;
    const now = new Date();

    // STEP 1: commit the plan change locally. If this throws the
    // whole apply attempt fails and the row stays pending for a retry.
    try {
        await billing.subscriptions.changePlan(subscriptionId, {
            newPlanId,
            newPriceId,
            prorationBehavior: 'none',
            applyAt: 'immediately'
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const newAttempt = scheduledPlanChange.attemptCount + 1;
        const exhausted = newAttempt >= MAX_APPLY_ATTEMPTS;

        await markChangeRetryOrFailed(billing, subscriptionId, scheduledPlanChange, {
            attemptCount: newAttempt,
            lastAttemptAt: now.toISOString(),
            lastError: message,
            exhausted
        });

        if (exhausted) {
            logger.error('Scheduled plan change exhausted retry budget', {
                subscriptionId,
                customerId,
                currentPlanId,
                newPlanId,
                attemptCount: newAttempt,
                error: message
            });
            return { kind: 'failed', attemptCount: newAttempt, error: message };
        }
        logger.warn('Scheduled plan change failed, will retry next tick', {
            subscriptionId,
            customerId,
            currentPlanId,
            newPlanId,
            attemptCount: newAttempt,
            error: message
        });
        return { kind: 'retry', attemptCount: newAttempt, error: message };
    }

    // STEP 2: propagate to MP preapproval — best-effort.
    if (mpSubscriptionId) {
        const paymentAdapter = billing.getPaymentAdapter();
        if (paymentAdapter) {
            try {
                await paymentAdapter.subscriptions.update(mpSubscriptionId, {
                    planId: newPlanId,
                    transactionAmount: targetTransactionAmountMajor
                });
            } catch (mpErr) {
                logger.error(
                    'Scheduled plan change: MP propagation failed (local change persisted)',
                    {
                        subscriptionId,
                        mpSubscriptionId,
                        newPlanId,
                        error: mpErr instanceof Error ? mpErr.message : String(mpErr)
                    }
                );
            }
        }
    }

    // STEP 3: addon recalc — best-effort.
    try {
        await handlePlanChangeAddonRecalculation({
            customerId,
            oldPlanId: currentPlanId,
            newPlanId,
            billing,
            db: getDb()
        });
    } catch (recalcErr) {
        logger.error('Scheduled plan change: addon recalculation failed (non-blocking)', {
            subscriptionId,
            customerId,
            newPlanId,
            error: recalcErr instanceof Error ? recalcErr.message : String(recalcErr)
        });
    }

    // STEP 4: clear entitlement cache so the next request sees the
    // new plan's entitlements.
    clearEntitlementCache(customerId);

    // STEP 5: mark the scheduled change as applied.
    try {
        await billing.subscriptions.update(subscriptionId, {
            scheduledPlanChange: {
                ...scheduledPlanChange,
                status: 'applied',
                attemptCount: scheduledPlanChange.attemptCount + 1,
                lastAttemptAt: now.toISOString(),
                resolvedAt: now.toISOString()
            }
        });
    } catch (markErr) {
        // The plan IS applied; failing to mark just means we'll try
        // again on the next tick. Returning 'applied' is honest about
        // the side effects that did land, but log the mark failure
        // so ops sees it.
        logger.error(
            'Scheduled plan change applied but failed to mark resolved — will retry mark next tick',
            {
                subscriptionId,
                error: markErr instanceof Error ? markErr.message : String(markErr)
            }
        );
    }

    logger.info('Scheduled plan change applied', {
        subscriptionId,
        customerId,
        oldPlanId: currentPlanId,
        newPlanId
    });
    return { kind: 'applied' };
}

/**
 * Update the scheduledPlanChange JSONB to reflect the latest failed
 * attempt — increments attemptCount, sets lastAttemptAt + lastError,
 * and flips to `failed` (with resolvedAt) when the retry budget is
 * exhausted.
 */
async function markChangeRetryOrFailed(
    billing: QZPayBilling,
    subscriptionId: string,
    current: QZPayScheduledPlanChange,
    update: {
        attemptCount: number;
        lastAttemptAt: string;
        lastError: string;
        exhausted: boolean;
    }
): Promise<void> {
    await billing.subscriptions.update(subscriptionId, {
        scheduledPlanChange: {
            ...current,
            attemptCount: update.attemptCount,
            lastAttemptAt: update.lastAttemptAt,
            lastError: update.lastError,
            status: update.exhausted ? 'failed' : 'pending',
            ...(update.exhausted ? { resolvedAt: update.lastAttemptAt } : {})
        }
    });
}

/**
 * Cron job definition — registered in `apps/api/src/cron/registry.ts`.
 */
export const applyScheduledPlanChangesJob: CronJobDefinition = {
    name: 'apply-scheduled-plan-changes',
    description:
        'Apply scheduled subscription plan changes (SPEC-141 D7 downgrade) whose applyAt has elapsed',
    schedule: '*/15 * * * *', // every 15 minutes
    enabled: true,
    timeoutMs: 5 * 60_000, // 5 minutes — plenty for the realistic 0-1 rows per tick

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('apply-scheduled-plan-changes: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        const billing = getQZPayBilling();
        if (!billing) {
            logger.warn('apply-scheduled-plan-changes: billing not configured, skipping');
            return {
                success: true,
                message: 'Skipped — billing not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startMs
            };
        }

        let dueRows: PendingPlanChangeRow[];
        try {
            dueRows = await findDueScheduledChanges();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('apply-scheduled-plan-changes: due-query failed', { error: message });
            return {
                success: false,
                message: `Due-query failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }

        if (dryRun) {
            logger.info('apply-scheduled-plan-changes: dry-run, listing only', {
                dueCount: dueRows.length
            });
            return {
                success: true,
                message: `Dry run — ${dueRows.length} scheduled change(s) would be applied`,
                processed: dueRows.length,
                errors: 0,
                durationMs: Date.now() - startMs,
                details: {
                    ids: dueRows.map((r) => r.subscriptionId)
                }
            };
        }

        let applied = 0;
        let retried = 0;
        let failed = 0;

        for (const row of dueRows) {
            try {
                const outcome = await applyOne(row, billing, logger);
                if (outcome.kind === 'applied') applied += 1;
                else if (outcome.kind === 'retry') retried += 1;
                else failed += 1;
            } catch (unexpectedErr) {
                // applyOne is wrapped internally for every failure
                // mode; reaching here means something escaped the
                // catch (e.g. mark-failed write also threw). Count
                // it as a failure so the tick's `errors` reflect
                // reality.
                failed += 1;
                logger.error('apply-scheduled-plan-changes: unexpected error in applyOne', {
                    subscriptionId: row.subscriptionId,
                    error:
                        unexpectedErr instanceof Error
                            ? unexpectedErr.message
                            : String(unexpectedErr)
                });
            }
        }

        return {
            success: failed === 0,
            message: `Applied ${applied}, retried ${retried}, failed ${failed}`,
            processed: applied + retried + failed,
            errors: failed,
            durationMs: Date.now() - startMs,
            details: { applied, retried, failed, due: dueRows.length }
        };
    }
};

/**
 * Internals exposed for unit tests only.
 */
export const _internals = {
    MAX_APPLY_ATTEMPTS,
    MAX_ROWS_PER_TICK,
    findDueScheduledChanges,
    applyOne,
    markChangeRetryOrFailed
};
