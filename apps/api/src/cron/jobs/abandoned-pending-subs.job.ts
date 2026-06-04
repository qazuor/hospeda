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
 * - Updates each row to `incomplete_expired` (qzpay vocabulary). The
 *   status mapping at the polling endpoint surfaces this as Hospeda
 *   `ABANDONED` so the front-end sees a single terminal state.
 * - A process-level advisory lock (`pg_try_advisory_xact_lock(1006)`)
 *   prevents overlapping runs across replicas.
 *
 * @module cron/jobs/abandoned-pending-subs
 */

import { billingSubscriptions, sql, withTransaction } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { checkSubscriptionStatusTransition } from '@repo/service-core';
import { and, inArray, isNull, lt } from 'drizzle-orm';
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
 * Terminal status written by the reaper. qzpay vocabulary is used so the
 * row stays consistent with how qzpay-core writes status; the polling
 * endpoint maps `incomplete_expired` -> Hospeda `ABANDONED` at the
 * response boundary.
 */
const ABANDONED_STATUS = 'incomplete_expired';

type CronTransactionResult = { skipped: true } | { skipped: false; abandoned: number };

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

                    return { skipped: false, abandoned: rows.length };
                }

                // Guard: verify pending_provider → abandoned is a permitted transition
                // before writing. This is a static pre-condition check on the canonical
                // transition; the WHERE clause already constrains affected rows to
                // PENDING_STATUSES so the `from` status is known. We use
                // `pending_provider` as the representative source status (the only
                // Hospeda-vocabulary pending status in PENDING_STATUSES; `incomplete`
                // is the qzpay-vocabulary synonym handled by T-003).
                //
                // TODO(SPEC-194 T-003): once `incomplete_expired` is folded into
                // `abandoned` in the DB, update ABANDONED_STATUS here and remove this
                // shim note.
                //
                // Keep writing `incomplete_expired` (ABANDONED_STATUS) — the polling
                // endpoint maps it to Hospeda `ABANDONED` at the response boundary.
                // Behaviour is unchanged; the guard only catches a future regression
                // where the transition table removes this edge.
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
                    return { skipped: false, abandoned: 0 };
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
                    .returning({ id: billingSubscriptions.id });

                return { skipped: false, abandoned: updated.length };
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
