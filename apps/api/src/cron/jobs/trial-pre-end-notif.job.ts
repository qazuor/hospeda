/**
 * Trial Pre-End Notification Cron Job (SPEC-126 D5)
 *
 * Sends D-3 (three days remaining) and D-1 (one day remaining) reminder
 * emails to users whose trial subscriptions are about to expire, pushing
 * them to start a paid subscription before the trial gap.
 *
 * Behaviour:
 * - Runs daily at 13:00 UTC (10:00 AR / UTC-3) so users get the email
 *   during business hours.
 * - Looks up trials with `status='trialing'` and `trialEnd` between
 *   `now + 1 day` and `now + 3 days`.
 * - For each, computes `daysRemaining = ceil((trialEnd - now) / 1 day)`.
 *   - `daysRemaining >= 2` → D-3 variant (covers the 2-3 day window so a
 *     trial gets reminded once early in the window even if the cron is
 *     skipped for a day).
 *   - `daysRemaining < 2` → D-1 variant.
 * - Dedup is enforced per variant via `billing_subscription_events`. Once
 *   `TRIAL_PRE_END_NOTIF_D3` is recorded for a sub the D-3 reminder will
 *   not fire again; same for `TRIAL_PRE_END_NOTIF_D1`.
 * - A process-level advisory lock (`pg_try_advisory_xact_lock(1005)`)
 *   prevents overlapping runs across replicas. The lock auto-releases on
 *   transaction commit.
 *
 * @module cron/jobs/trial-pre-end-notif
 */

import { billingSubscriptionEvents, billingSubscriptions, sql, withTransaction } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { BILLING_EVENT_TYPES } from '@repo/service-core';
import { and, between, eq, isNull } from 'drizzle-orm';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { env } from '../../utils/env.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for the trial-pre-end-notif job. Picked from
 * the same range used by sibling billing crons (`dunning` uses 1003,
 * `trial-expiry` uses 1004).
 */
const ADVISORY_LOCK_KEY = 1005;

/** One day in milliseconds, used to compute trial windows and remaining days. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Compute `daysRemaining` rounding UP, so a trial ending in 36 hours
 * surfaces as 2 days remaining (not 1). The cron runs once per day, so
 * one-off skew of a few hours is tolerated, but truncation would cause a
 * 1-day-remaining sub to disappear from the D-3 window prematurely.
 */
function computeDaysRemaining(trialEnd: Date, now: Date): number {
    const deltaMs = trialEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(deltaMs / ONE_DAY_MS));
}

/**
 * Pick the reminder variant for a given `daysRemaining` value.
 *
 * - 2 or 3 days out → D-3 (the "your trial ends soon" warm-up email)
 * - 1 day out → D-1 (the "your trial ends tomorrow" urgency email)
 * - 0 or less → handled by the trial-expiry cron, not this one
 * - 4+ → outside the window, should not reach this function
 */
function selectVariant(daysRemaining: number): 'D3' | 'D1' | null {
    if (daysRemaining >= 2) return 'D3';
    if (daysRemaining === 1) return 'D1';
    return null;
}

/**
 * Map the variant to its corresponding `BILLING_EVENT_TYPES` key. Kept as
 * a helper to keep `selectVariant` pure (it returns a discriminator) and
 * to make the call site at the bottom of the handler easy to read.
 */
function variantToEventType(variant: 'D3' | 'D1') {
    return variant === 'D3'
        ? BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3
        : BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D1;
}

/**
 * Build the upgrade CTA URL embedded in the reminder email. Points at
 * `/cuenta/planes` because that page lists available plans and triggers
 * the `start-paid` flow. The `?utm_source` parameter helps the team
 * measure conversion attribution from this specific email.
 */
function buildUpgradeUrl(variant: 'D3' | 'D1'): string {
    const base = `${env.HOSPEDA_SITE_URL}/cuenta/planes`;
    return `${base}?utm_source=email&utm_medium=lifecycle&utm_campaign=trial-${variant.toLowerCase()}`;
}

/**
 * Discriminated union returned by the inner transaction so the outer
 * handler can distinguish "lock not acquired (silent skip)" from
 * "ran, here are the counters" without conflating the two.
 */
type CronTransactionResult =
    | { skipped: true }
    | {
          skipped: false;
          processed: number;
          notificationsSent: number;
          dedupSkipped: number;
          errors: number;
      };

/**
 * Trial pre-end notification cron job.
 */
export const trialPreEndNotifJob: CronJobDefinition = {
    name: 'trial-pre-end-notif',
    description: 'Daily reminder emails for trials ending in 1-3 days (D-3 and D-1 variants).',
    schedule: '0 13 * * *', // 10:00 AR / 13:00 UTC, daily
    enabled: true,
    timeoutMs: 5 * 60 * 1000, // 5 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting trial pre-end notification job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        const billing = getQZPayBilling();

        if (!billing) {
            logger.warn('Billing not configured, skipping trial pre-end notif job');
            return {
                success: true,
                message: 'Skipped - Billing not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime()
            };
        }

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                // Process-level lock: a single replica processes the window
                // per run. Auto-releases on commit/rollback (transaction-mode
                // safe; see dunning.job.ts:131 for the rationale).
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const now = new Date();
                const windowStart = new Date(now.getTime() + ONE_DAY_MS);
                const windowEnd = new Date(now.getTime() + 3 * ONE_DAY_MS);

                const trialsInWindow = await tx
                    .select({
                        id: billingSubscriptions.id,
                        customerId: billingSubscriptions.customerId,
                        planId: billingSubscriptions.planId,
                        trialEnd: billingSubscriptions.trialEnd
                    })
                    .from(billingSubscriptions)
                    .where(
                        and(
                            eq(billingSubscriptions.status, 'trialing'),
                            isNull(billingSubscriptions.deletedAt),
                            // trialEnd may be null on legacy rows; the between()
                            // clause naturally filters those out because nulls
                            // never satisfy a range comparison.
                            between(billingSubscriptions.trialEnd, windowStart, windowEnd)
                        )
                    );

                let notificationsSent = 0;
                let dedupSkipped = 0;
                let errors = 0;

                for (const trial of trialsInWindow) {
                    if (!trial.trialEnd) {
                        continue;
                    }

                    const daysRemaining = computeDaysRemaining(new Date(trial.trialEnd), now);
                    const variant = selectVariant(daysRemaining);

                    if (!variant) {
                        continue;
                    }

                    const eventType = variantToEventType(variant);

                    // Dedup: skip if this variant was already sent for this
                    // subscription on any previous run.
                    const existingEvent = await tx
                        .select({ id: billingSubscriptionEvents.id })
                        .from(billingSubscriptionEvents)
                        .where(
                            and(
                                eq(billingSubscriptionEvents.subscriptionId, trial.id),
                                eq(billingSubscriptionEvents.eventType, eventType)
                            )
                        )
                        .limit(1);

                    if (existingEvent.length > 0) {
                        dedupSkipped++;
                        continue;
                    }

                    if (dryRun) {
                        logger.debug('Would send trial pre-end reminder', {
                            subscriptionId: trial.id,
                            customerId: trial.customerId,
                            variant,
                            daysRemaining
                        });
                        notificationsSent++;
                        continue;
                    }

                    try {
                        const customer = await billing.customers.get(trial.customerId);
                        const plan = await billing.plans.get(trial.planId);

                        if (!customer || !plan) {
                            logger.warn('Skipping trial reminder: customer or plan missing', {
                                subscriptionId: trial.id,
                                customerId: trial.customerId,
                                planId: trial.planId,
                                customerFound: customer !== null,
                                planFound: plan !== null
                            });
                            continue;
                        }

                        const recipientName =
                            typeof customer.metadata?.name === 'string'
                                ? customer.metadata.name
                                : customer.email.split('@')[0];

                        await sendNotification({
                            type: NotificationType.TRIAL_ENDING_REMINDER,
                            recipientEmail: customer.email,
                            recipientName: recipientName ?? customer.email,
                            userId: null,
                            customerId: customer.id,
                            idempotencyKey: `trial-pre-end-${variant.toLowerCase()}-${trial.id}`,
                            planName: plan.name,
                            trialEndDate: new Date(trial.trialEnd).toISOString(),
                            daysRemaining,
                            upgradeUrl: buildUpgradeUrl(variant)
                        });

                        // Record the dedup event inside the same transaction so
                        // the lock + the event insert commit together. A future
                        // run sees the event and skips this variant.
                        await tx.insert(billingSubscriptionEvents).values({
                            subscriptionId: trial.id,
                            eventType,
                            triggerSource: 'cron',
                            metadata: {
                                variant,
                                daysRemaining,
                                trialEnd: new Date(trial.trialEnd).toISOString(),
                                sentAt: new Date().toISOString()
                            }
                        });

                        notificationsSent++;
                    } catch (err) {
                        errors++;
                        logger.error('Failed to send trial pre-end reminder', {
                            subscriptionId: trial.id,
                            customerId: trial.customerId,
                            variant,
                            error: err instanceof Error ? err.message : String(err)
                        });
                    }
                }

                return {
                    skipped: false,
                    processed: trialsInWindow.length,
                    notificationsSent,
                    dedupSkipped,
                    errors
                };
            });

            if (cronResult.skipped) {
                logger.info('Trial pre-end notif job skipped: another replica holds the lock');
                return {
                    success: true,
                    message: 'Skipped - another replica is running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            const durationMs = Date.now() - startedAt.getTime();
            logger.info('Trial pre-end notif job completed', {
                processed: cronResult.processed,
                notificationsSent: cronResult.notificationsSent,
                dedupSkipped: cronResult.dedupSkipped,
                errors: cronResult.errors,
                durationMs,
                dryRun
            });

            return {
                success: cronResult.errors === 0,
                message: `Sent ${cronResult.notificationsSent} reminder(s), skipped ${cronResult.dedupSkipped} duplicate(s), ${cronResult.errors} error(s)`,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs,
                details: {
                    notificationsSent: cronResult.notificationsSent,
                    dedupSkipped: cronResult.dedupSkipped,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startedAt.getTime();

            logger.error('Trial pre-end notif job failed', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });

            return {
                success: false,
                message: `Failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};

/**
 * Exported helpers for unit testing the variant-selection logic without
 * spinning up the cron context.
 */
export const _internals = {
    computeDaysRemaining,
    selectVariant,
    variantToEventType,
    buildUpgradeUrl,
    ADVISORY_LOCK_KEY,
    ONE_DAY_MS
};
