/**
 * Abandoned Pending Subscriptions Cron Job (SPEC-126 D6)
 *
 * Reaps subscriptions that were created with `mode: 'paid'` (SPEC-124
 * wiring) but never had their provider preapproval confirmed before the
 * TTL expired. Without this reaper, abandoned rows would linger forever
 * in `incomplete` / `pending_provider` and pollute the customer's
 * subscription list.
 *
 * Behaviour:
 * - Runs every hour (minute 0).
 * - Targets `billing_subscriptions` rows where:
 *   - `status IN ('incomplete', 'pending_provider')` — covers both
 *     qzpay-vocabulary writes (mode='paid' create) and Hospeda-vocabulary
 *     writes (any future direct insert that uses `pending_provider`),
 *   - `created_at < now - 30 minutes` — matches the 30min `expiresAt`
 *     window the start-paid route returns to the front,
 *   - `deleted_at IS NULL`.
 * - Updates each row to canonical `abandoned` (Hospeda enum vocabulary).
 *   Legacy `incomplete_expired` rows written before this fix are handled
 *   by the `010-abandoned-status.data-migration.sql` extras migration.
 * - A process-level advisory lock (`pg_try_advisory_xact_lock(1006)`)
 *   prevents overlapping runs across replicas.
 *
 * @module cron/jobs/abandoned-pending-subs
 */

import { billingSubscriptions, sql, withTransaction } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { checkSubscriptionStatusTransition } from '@repo/service-core';
import { and, inArray, isNull, lt } from 'drizzle-orm';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for this job. Sibling billing crons use
 * 1003 (dunning), 1004 (trial-expiry), 1005 (trial-pre-end-notif).
 */
const ADVISORY_LOCK_KEY = 1006;

/**
 * TTL applied to `pending_provider` / `incomplete` rows before the
 * reaper marks them abandoned. Matches the `expiresAt` returned by
 * `POST /api/v1/protected/billing/subscriptions/start-paid` so the
 * front-end and the cron agree on when a row is "stale".
 */
const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/**
 * Subscription statuses that this cron considers "abandonable". qzpay-core
 * writes `incomplete` during its `mode: 'paid'` flow; the Hospeda enum
 * `pending_provider` is included for forward compatibility with any
 * direct-insert path that bypasses qzpay-core.
 */
const PENDING_STATUSES = ['incomplete', 'pending_provider'] as const;

/**
 * Terminal status written by the reaper. Uses the canonical Hospeda enum
 * value so DB queries for `status = 'abandoned'` find all abandoned rows.
 * Legacy rows that were written as `incomplete_expired` before this fix are
 * handled by the `010-abandoned-status.data-migration.sql` extras migration.
 */
const ABANDONED_STATUS = SubscriptionStatusEnum.ABANDONED;

/** Minimal subscription info returned from the bulk UPDATE for post-commit notifications. */
interface AbandonedSubInfo {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
}

type CronTransactionResult =
    | { skipped: true }
    | { skipped: false; abandoned: number; subs: readonly AbandonedSubInfo[] };

/**
 * Abandoned pending subscriptions cron job.
 */
export const abandonedPendingSubsJob: CronJobDefinition = {
    name: 'abandoned-pending-subs',
    description:
        'Marks subscriptions stuck in pending_provider/incomplete past the 30-minute TTL as abandoned.',
    schedule: '0 * * * *', // Hourly at minute 0
    enabled: true,
    timeoutMs: 2 * 60 * 1000, // 2 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting abandoned-pending-subs job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const cutoff = new Date(Date.now() - PENDING_PROVIDER_TTL_MS);

                if (dryRun) {
                    // Count without writing so operators can preview impact
                    // before flipping `dryRun` off in prod.
                    const rows = await tx
                        .select({ id: billingSubscriptions.id })
                        .from(billingSubscriptions)
                        .where(
                            and(
                                inArray(billingSubscriptions.status, [...PENDING_STATUSES]),
                                lt(billingSubscriptions.createdAt, cutoff),
                                isNull(billingSubscriptions.deletedAt)
                            )
                        );

                    return { skipped: false, abandoned: rows.length, subs: [] };
                }

                // Guard: verify pending_provider → abandoned is a permitted transition
                // before writing. This is a static pre-condition check on the canonical
                // transition; the WHERE clause already constrains affected rows to
                // PENDING_STATUSES so the `from` status is known. We use
                // `pending_provider` as the representative source status (the only
                // Hospeda-vocabulary pending status in PENDING_STATUSES; `incomplete`
                // is the qzpay-vocabulary synonym for it).
                // The guard only catches a future regression where the transition
                // table removes this edge.
                const guardCheck = checkSubscriptionStatusTransition({
                    from: SubscriptionStatusEnum.PENDING_PROVIDER,
                    to: SubscriptionStatusEnum.ABANDONED
                });
                if (!guardCheck.valid) {
                    logger.error(
                        'abandoned-pending-subs: invalid transition guard — skipping bulk status write',
                        {
                            from: SubscriptionStatusEnum.PENDING_PROVIDER,
                            to: SubscriptionStatusEnum.ABANDONED,
                            reason: guardCheck.reason
                        }
                    );
                    return { skipped: false, abandoned: 0, subs: [] };
                }

                const updated = await tx
                    .update(billingSubscriptions)
                    .set({ status: ABANDONED_STATUS, updatedAt: new Date() })
                    .where(
                        and(
                            inArray(billingSubscriptions.status, [...PENDING_STATUSES]),
                            lt(billingSubscriptions.createdAt, cutoff),
                            isNull(billingSubscriptions.deletedAt)
                        )
                    )
                    .returning({
                        id: billingSubscriptions.id,
                        customerId: billingSubscriptions.customerId,
                        planId: billingSubscriptions.planId
                    });

                return { skipped: false, abandoned: updated.length, subs: updated };
            });

            if (cronResult.skipped) {
                logger.info('Abandoned-pending-subs job skipped: another replica holds the lock');
                return {
                    success: true,
                    message: 'Skipped - another replica is running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // Best-effort user notifications — one failure must not abort the sweep.
            // Sent after the transaction commits so the DB state is authoritative.
            if (!dryRun && cronResult.subs.length > 0) {
                const billing = getQZPayBilling();

                for (const sub of cronResult.subs) {
                    try {
                        if (!billing) {
                            logger.warn(
                                'Billing not configured — skipping abandoned-sub notification',
                                { subscriptionId: sub.id }
                            );
                            break;
                        }

                        const customer = await billing.customers.get(sub.customerId);
                        const plan = await billing.plans.get(sub.planId);

                        if (!customer) {
                            logger.warn(
                                'Customer not found for abandoned-sub notification — skipping',
                                { subscriptionId: sub.id, customerId: sub.customerId }
                            );
                            continue;
                        }

                        const recipientName =
                            typeof customer.metadata?.name === 'string'
                                ? customer.metadata.name
                                : customer.email.split('@')[0];

                        await sendNotification({
                            type: NotificationType.SUBSCRIPTION_CANCELLED,
                            recipientEmail: customer.email,
                            recipientName: recipientName ?? customer.email,
                            userId: null,
                            customerId: customer.id,
                            idempotencyKey: `abandoned-sub-${sub.id}`,
                            planName: plan?.name ?? sub.planId
                        });

                        logger.debug('Sent abandoned-sub notification', {
                            subscriptionId: sub.id,
                            customerId: sub.customerId
                        });
                    } catch (notifError) {
                        logger.warn('Failed to send abandoned-sub notification — continuing', {
                            subscriptionId: sub.id,
                            customerId: sub.customerId,
                            error:
                                notifError instanceof Error
                                    ? notifError.message
                                    : String(notifError)
                        });
                    }
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Abandoned-pending-subs job completed', {
                abandoned: cronResult.abandoned,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: dryRun
                    ? `Dry run - would abandon ${cronResult.abandoned} subscription(s)`
                    : `Marked ${cronResult.abandoned} subscription(s) as abandoned`,
                processed: cronResult.abandoned,
                errors: 0,
                durationMs,
                details: { dryRun, abandoned: cronResult.abandoned }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startedAt.getTime();

            logger.error('Abandoned-pending-subs job failed', {
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
 * Exported helpers for unit testing the constants and the job definition
 * without spinning up a real DB.
 */
export const _internals = {
    ADVISORY_LOCK_KEY,
    PENDING_PROVIDER_TTL_MS,
    PENDING_STATUSES,
    ABANDONED_STATUS
};
