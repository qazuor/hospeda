/**
 * Apply Scheduled Plan Changes Cron Job (SPEC-141 D7 downgrade).
 *
 * Fires every 15 minutes and applies any subscription whose
 * `scheduledPlanChange.status === 'pending'` and
 * `scheduledPlanChange.applyAt <= now()` — typically downgrades
 * queued by the plan-change route to take effect at
 * `currentPeriodEnd`.
 *
 * The apply sequence (SPEC-194 T-011 idempotency fix):
 *   0. Pre-stamp the row to `status: 'applied'` BEFORE mutating the
 *      plan. This atomically removes it from the eligibility query
 *      so a later finalise failure can NEVER cause a re-apply.
 *   1. `billing.subscriptions.changePlan(...)` — flips local planId.
 *      If this throws, the pre-stamp is rolled back to `status:
 *      'pending'` (or `'failed'` when budget exhausted).
 *   2. `paymentAdapter.subscriptions.update(...)` — propagates the
 *      new recurring amount to MP — best-effort, logged on failure.
 *   3. `handlePlanChangeAddonRecalculation(...)` — refreshes addon
 *      limits — best-effort.
 *   4. `clearEntitlementCache(customerId)` — flips entitlements to
 *      the new plan in the running process.
 *   5. Finalise: update `resolvedAt` + `attemptCount` — pure
 *      bookkeeping; the row is already `'applied'` from step 0 so
 *      failure here carries no re-apply risk.
 *
 * Failures:
 *   - Step 0 (pre-stamp) throws → skip this tick; row stays
 *     `pending`, retried next tick. Nothing mutated.
 *   - Step 1 throws → rollback pre-stamp; increment `attemptCount`,
 *     set `lastAttemptAt` + `lastError`, keep status `pending`.
 *     After `MAX_APPLY_ATTEMPTS` failures the change flips to
 *     `failed` and the cron stops retrying — ops needs to intervene
 *     (Sentry alert via `apiLogger.error`).
 *   - Steps 2–4 fail → logged, the plan change is still considered
 *     applied (the local change already succeeded, the webhook
 *     reconciliation path eventually fixes MP drift).
 *   - Step 5 (finalise) fails → logged; `resolvedAt` missing but
 *     no re-apply risk (row is already `'applied'` from step 0).
 *
 * @module cron/jobs/apply-scheduled-plan-changes
 */

import type { QZPayBilling, QZPayScheduledPlanChange } from '@qazuor/qzpay-core';
import { billingSubscriptions, getDb, sql } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { handlePlanChangeAddonRecalculation } from '../../services/addon-plan-change.service.js';
import { applyDowngradeRestrictions } from '../../services/plan-downgrade-remediation.service.js';
import { PlanCatalogMissError } from '../../services/subscription-downgrade-excess.service.js';
import { getKeepSelectionsForChange } from '../../services/subscription-downgrade.service.js';
import { resolveOwnerUserId } from '../../services/subscription-pause.service.js';
import { sendNotification } from '../../utils/notification-helper.js';
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
 *
 * The `scheduledPlanChange` column (`billing_subscriptions.scheduled_plan_change`,
 * JSONB, defined in qzpay-drizzle, typed as `QZPayScheduledPlanChange` in
 * qzpay-core) carries the canonical shape this cron and the plan-change
 * route share. Documented here because the column lives in an external
 * package and the smoke checklist / seed paths discovered the wrong field
 * names twice (`effectiveAt` vs `applyAt`, `targetPlanId` vs `newPlanId`)
 * during SPEC-143 Block 2 smoke 1.6:
 *
 *   {
 *     status: 'pending' | 'applied' | 'failed',
 *     newPlanId: string,                 // target plan UUID
 *     applyAt: ISO timestamp string,     // when the change becomes due
 *     requestedAt: ISO timestamp string, // when the plan change was queued
 *     changeType: 'downgrade' | 'upgrade',
 *     attemptCount: number,              // bumped on each apply retry
 *     resolvedAt?: ISO timestamp string, // set when status → applied | failed
 *     lastAttemptAt?: ISO timestamp string,
 *     lastError?: string                 // populated on failed attempts
 *   }
 *
 * Seeding a scheduled change in tests / smokes MUST use these exact field
 * names — the cron filter scans on `scheduledPlanChange.applyAt` and
 * `scheduledPlanChange.status === 'pending'` (`idx_subscriptions_pending_plan_change`
 * partial index), so anything else is silently invisible to this job.
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
 *
 * `restrictionFailed` is set to `true` when the plan change was applied
 * successfully but the downgrade restriction step (SPEC-167 T-013) threw.
 * The plan change stays committed; the handler uses this flag to set
 * `result.success=false` so SPEC-149's bootstrap Sentry capture fires.
 * The restriction is idempotent — the next cron tick or a manual re-trigger
 * of remediation will retry it. An over-cap-but-unrestricted host is the
 * old status quo (revenue leak), not data corruption.
 */
type ApplyOutcome =
    | { kind: 'applied'; restrictionFailed?: boolean }
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
 * Idempotency guarantee (SPEC-194 T-011):
 *
 *   Before calling `changePlan` (step 1), the row is pre-stamped to
 *   `status: 'applied'` via a `billing.subscriptions.update` call
 *   (step 0). This takes the row out of the eligibility query
 *   (`status = 'pending'`) so that, regardless of what happens to the
 *   finalise write (step 5), the next tick can never re-run
 *   `changePlan` on the same row.
 *
 *   If `changePlan` subsequently fails, step 0's stamp is rolled back
 *   to `status: 'pending'` (with incremented `attemptCount`) by
 *   `markChangeRetryOrFailed`. If the rollback itself fails, the row
 *   stays `'applied'` — a false-positive is acceptable; re-applying a
 *   plan change twice is not.
 *
 *   Steps 2–4 (MP propagate / addon recalc / cache clear) failing are
 *   logged but do NOT trigger a retry, because the local change already
 *   succeeded.
 *
 *   Step 5 (finalise: add `resolvedAt`) is pure bookkeeping. Failure
 *   there does NOT count as an apply-failure and does NOT cause
 *   `changePlan` to re-run — the pre-stamp already guarantees that.
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

    // STEP 0: pre-stamp the row to `status: 'applied'` BEFORE mutating
    // the plan. This atomically removes the row from the
    // `status = 'pending'` eligibility filter so that a later
    // markResolved failure cannot cause the next tick to re-run
    // changePlan. If the pre-stamp itself fails, skip this tick; the
    // row stays `pending` and will be retried — safe because we have
    // not yet mutated anything.
    try {
        await billing.subscriptions.update(subscriptionId, {
            scheduledPlanChange: {
                ...scheduledPlanChange,
                status: 'applied',
                lastAttemptAt: now.toISOString()
            }
        });
    } catch (preStampErr) {
        logger.error('Scheduled plan change: pre-stamp failed, skipping tick', {
            subscriptionId,
            error: preStampErr instanceof Error ? preStampErr.message : String(preStampErr)
        });
        // Return as retry so the outer handler counts it correctly and
        // the row stays pending for the next tick.
        return {
            kind: 'retry',
            attemptCount: scheduledPlanChange.attemptCount,
            error: preStampErr instanceof Error ? preStampErr.message : String(preStampErr)
        };
    }

    // STEP 1: commit the plan change locally. If this throws, roll back
    // the pre-stamp to `pending` so the row re-enters the eligibility
    // queue on the next tick.
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

        // Roll back the pre-stamp: flip status back to pending (or
        // failed if budget exhausted) with updated attempt metadata.
        // Wrap in its own try/catch (item 8 / SPEC-194 adversarial review):
        // if markChangeRetryOrFailed itself fails, the row stays 'applied'
        // (the pre-stamp from step 0) but the plan change was NOT applied —
        // this is a split-state that requires operator investigation.
        try {
            await markChangeRetryOrFailed(billing, subscriptionId, scheduledPlanChange, {
                attemptCount: newAttempt,
                lastAttemptAt: now.toISOString(),
                lastError: message,
                exhausted
            });
        } catch (rollbackErr) {
            // Row remains pre-stamped 'applied' but is NOT applied — operator must
            // inspect and manually correct (include scheduledChangeId + subscriptionId).
            logger.error(
                'Scheduled plan change: rollback of pre-stamp failed — row is stuck as applied but plan NOT applied; manual intervention required',
                {
                    subscriptionId,
                    scheduledChangeId: scheduledPlanChange.requestedAt, // best unique identifier in the shape
                    rollbackError:
                        rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
                    originalError: message
                }
            );
        }

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
    // Note: restriction (step 3b) does NOT touch addons; addon recalc is
    // independent and runs first so it always reflects the new plan's base limits
    // regardless of which excess resources are subsequently restricted.
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

    // STEP 3b: downgrade restriction (SPEC-167 T-013) — runs BEFORE cache clear
    // so the cache is invalidated with the post-restriction state.
    //
    // Direction detection: `metadata.source === 'plan-change-downgrade'` is set
    // by `scheduleSubscriptionDowngrade` (subscription-downgrade.service.ts).
    // The QZPayScheduledPlanChange TypeScript type does not expose a `changeType`
    // field; the cron's documented shape comment is aspirational — the actual
    // runtime marker we rely on is the metadata source field. Scheduled upgrades
    // do not go through this cron (upgrades are applied immediately via the
    // webhook path which calls applyUpgradeRestorationsOrWarn), so a row without
    // source='plan-change-downgrade' is treated as non-downgrade and skipped.
    //
    // Failure semantics: restriction failure must NOT roll back the applied plan
    // change (the pre-stamp from step 0 already committed; the plan change is
    // the source of truth). Instead, catch the error, log loudly, and signal
    // restrictionFailed=true to the handler — the handler sets result.success=false
    // so SPEC-149's bootstrap Sentry capture fires.
    //
    // Recovery path: applyDowngradeRestrictions is idempotent, but the cron
    // CANNOT auto-retry this failure. The pre-stamp in step 0 already committed
    // status='applied', so the eligibility filter (status='pending') will never
    // pick up this row again. Recovery is MANUAL-ONLY: ops must re-run
    // applyDowngradeRestrictions directly via the remediation service for the
    // affected subscription. The Sentry error below (logged via logger.error)
    // carries subscriptionId/customerId/newPlanId so ops can locate affected
    // subscriptions without PII exposure.
    const meta = scheduledPlanChange.metadata as Record<string, unknown> | undefined | null;
    const isDowngrade = meta?.source === 'plan-change-downgrade';
    let restrictionFailed = false;
    if (isDowngrade) {
        try {
            // Resolve the userId (owner) from the billing customer ID.
            const userId = await resolveOwnerUserId({ customerId });

            if (userId) {
                // Resolve the target plan slug from the plan ID so
                // applyDowngradeRestrictions can look up limits.
                let targetPlanSlug: string | null = null;
                try {
                    const plan = await billing.plans.get(newPlanId);
                    targetPlanSlug = plan?.name ?? null;
                } catch (slugErr) {
                    logger.warn(
                        'Scheduled plan change: could not resolve target plan slug for restriction',
                        {
                            subscriptionId,
                            customerId,
                            newPlanId,
                            error: slugErr instanceof Error ? slugErr.message : String(slugErr)
                        }
                    );
                }

                if (targetPlanSlug) {
                    // Read host's persisted keepSelections from the scheduled change
                    // metadata. Returns undefined when absent → defaults apply in
                    // applyDowngradeRestrictions (most-recently-updated sort).
                    const keepSelections = getKeepSelectionsForChange(scheduledPlanChange);

                    await applyDowngradeRestrictions({
                        userId,
                        customerId,
                        targetPlanSlug,
                        keepSelections
                    });
                } else {
                    logger.warn(
                        'Scheduled plan change: skipping restriction — target plan slug unresolvable',
                        { subscriptionId, customerId, newPlanId }
                    );
                }
            } else {
                logger.warn(
                    'Scheduled plan change: skipping restriction — could not resolve owner userId',
                    { subscriptionId, customerId }
                );
            }
        } catch (restrictionErr) {
            // PlanCatalogMissError: the target plan slug is not registered in
            // the static billing catalog (e.g. a test plan or a plan predating
            // the restriction feature). Without catalog metadata we cannot
            // evaluate excess, so we soft-skip restriction rather than treating
            // it as a data-integrity failure.
            //
            // Revenue-leak rationale: a catalog-miss on a real downgrade means
            // an over-cap host went unrestricted (SPEC-148 plan-disable can
            // cause it). We surface this in Sentry at warning level so it is
            // visible in alerting without failing the job or rolling back the
            // plan change. Pattern mirrors webhook-retry.job.ts dead-letter path.
            if (restrictionErr instanceof PlanCatalogMissError) {
                const errMsg = restrictionErr.message;
                logger.warn(
                    'Scheduled plan change: skipping restriction — target plan not in catalog (non-blocking)',
                    {
                        subscriptionId,
                        customerId,
                        newPlanId,
                        planSlug: restrictionErr.planSlug,
                        error: errMsg
                    }
                );
                Sentry.captureMessage(
                    'Scheduled plan change: restriction skipped — target plan not in catalog',
                    {
                        level: 'warning',
                        tags: {
                            module: 'cron',
                            job_name: 'apply-scheduled-plan-changes',
                            event_type: 'restriction_catalog_miss'
                        },
                        extra: {
                            subscriptionId,
                            customerId,
                            newPlanId,
                            planSlug: restrictionErr.planSlug
                        }
                    }
                );
            } else {
                // Any other error is a genuine restriction failure — log loudly
                // so Sentry captures it (via bootstrap.ts error handler) and set
                // restrictionFailed so the cron result surfaces success=false.
                // The extra fields (subscriptionId, customerId, newPlanId) allow
                // ops to locate affected subscriptions for manual remediation
                // (see Recovery path comment above).
                const errMsg =
                    restrictionErr instanceof Error
                        ? restrictionErr.message
                        : String(restrictionErr);
                logger.error(
                    'Scheduled plan change: downgrade restriction failed (non-blocking — plan change stays applied; MANUAL remediation required)',
                    {
                        subscriptionId,
                        customerId,
                        newPlanId,
                        error: errMsg,
                        restrictionFailedAt: new Date().toISOString()
                    }
                );
                restrictionFailed = true;
            }
        }
    }

    // STEP 3c: PLAN_CHANGE_CONFIRMATION notification — informational, SOFT.
    //
    // Sent after the plan change applies (step 1) so the host receives a
    // confirmation email once the new plan is in effect.
    //
    // Asymmetry with restriction failure (step 3b): notification failure does
    // NOT set `restrictionFailed` and does NOT flip `result.success`. A missed
    // confirmation email is unfortunate but does not indicate a data-integrity
    // problem — the plan change is applied regardless. Restriction failure, by
    // contrast, leaves the host over-cap (revenue-leak risk) and warrants a
    // Sentry alert.
    //
    // Exactly-once guarantee: this step runs once per `applyOne` invocation.
    // `applyOne` is only called when the row passes the `status='pending'`
    // eligibility filter — the pre-stamp in step 0 flips it to 'applied'
    // before `changePlan` runs, so the cron can never re-apply the same row.
    try {
        // Resolve customer email for the confirmation address.
        const customer = await billing.customers.get(customerId);
        if (customer) {
            // Resolve plan names for the "old plan → new plan" display copy.
            let oldPlanName: string | undefined;
            let newPlanName: string | undefined;
            try {
                const [oldPlan, newPlan] = await Promise.all([
                    billing.plans.get(currentPlanId),
                    billing.plans.get(newPlanId)
                ]);
                oldPlanName = oldPlan?.name ?? currentPlanId;
                newPlanName = newPlan?.name ?? newPlanId;
            } catch (planErr) {
                logger.warn(
                    'Scheduled plan change: could not resolve plan names for confirmation',
                    {
                        subscriptionId,
                        customerId,
                        error: planErr instanceof Error ? planErr.message : String(planErr)
                    }
                );
                // Names default to IDs — still send the notification (better than nothing).
                oldPlanName = currentPlanId;
                newPlanName = newPlanId;
            }

            const customerName = String(
                (customer.metadata as Record<string, unknown> | null | undefined)?.name ??
                    customer.email
            );

            void Promise.resolve(
                sendNotification({
                    type: NotificationType.PLAN_CHANGE_CONFIRMATION,
                    recipientEmail: customer.email,
                    recipientName: customerName,
                    userId: String(
                        (customer.metadata as Record<string, unknown> | null | undefined)?.userId ??
                            null
                    ),
                    customerId,
                    oldPlanName,
                    newPlanName,
                    planName: newPlanName
                })
            ).catch((notifErr: unknown) => {
                // SOFT: confirmation failure must never affect the plan-change outcome.
                // Unlike restriction failure (step 3b), this does NOT set restrictionFailed.
                logger.warn(
                    'Scheduled plan change: PLAN_CHANGE_CONFIRMATION send failed (soft-fail)',
                    {
                        subscriptionId,
                        customerId,
                        error: notifErr instanceof Error ? notifErr.message : String(notifErr)
                    }
                );
            });
        } else {
            logger.warn(
                'Scheduled plan change: PLAN_CHANGE_CONFIRMATION skipped — customer not found',
                { subscriptionId, customerId }
            );
        }
    } catch (confirmErr) {
        // Customer lookup or plan resolution failed — warn and skip notification.
        // The plan change is already applied; this is informational only.
        logger.warn(
            'Scheduled plan change: PLAN_CHANGE_CONFIRMATION customer lookup failed (soft-fail)',
            {
                subscriptionId,
                customerId,
                error: confirmErr instanceof Error ? confirmErr.message : String(confirmErr)
            }
        );
    }

    // STEP 4: clear entitlement cache so the next request sees the
    // new plan's entitlements. Runs AFTER restriction (step 3b) so the
    // cache reflects the post-restriction state on first invalidation.
    clearEntitlementCache(customerId);

    // STEP 5: finalise — add resolvedAt and bump attemptCount.
    // This is pure bookkeeping: the row is already `'applied'` from the
    // pre-stamp (step 0), so failure here does NOT cause changePlan to
    // re-run. Log any failure so ops can see it, but do not change the
    // outcome — the plan change IS applied.
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
    } catch (finaliseErr) {
        // Row is already 'applied' from the pre-stamp — no re-apply
        // risk. Log so ops can reconcile the missing resolvedAt if
        // needed (e.g. via a future cleanup cron).
        logger.error(
            'Scheduled plan change applied but finalise write failed — resolvedAt missing (no re-apply risk)',
            {
                subscriptionId,
                error: finaliseErr instanceof Error ? finaliseErr.message : String(finaliseErr)
            }
        );
    }

    logger.info('Scheduled plan change applied', {
        subscriptionId,
        customerId,
        oldPlanId: currentPlanId,
        newPlanId,
        restrictionFailed
    });
    return { kind: 'applied', ...(restrictionFailed ? { restrictionFailed: true } : {}) };
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
        // Tracks rows where the plan change applied cleanly but the downgrade
        // restriction step (SPEC-167 T-013) failed. The plan change itself is
        // committed; this count drives result.success=false so SPEC-149's
        // bootstrap Sentry capture fires. The restriction is idempotent and
        // can be retried on the next tick or via manual remediation.
        let restrictionErrors = 0;

        for (const row of dueRows) {
            try {
                const outcome = await applyOne(row, billing, logger);
                if (outcome.kind === 'applied') {
                    applied += 1;
                    if (outcome.restrictionFailed) restrictionErrors += 1;
                } else if (outcome.kind === 'retry') retried += 1;
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
            success: failed === 0 && restrictionErrors === 0,
            message: `Applied ${applied}, retried ${retried}, failed ${failed}${restrictionErrors > 0 ? `, restrictionErrors ${restrictionErrors}` : ''}`,
            processed: applied + retried + failed,
            errors: failed + restrictionErrors,
            durationMs: Date.now() - startMs,
            details: { applied, retried, failed, restrictionErrors, due: dueRows.length }
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
