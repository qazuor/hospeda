/**
 * Social Publish Dispatch Cron Job
 *
 * Drives the Make.com dispatch loop for social post publishing.
 * On each run it queries for eligible social_post_targets (APPROVED, due for
 * dispatch) and POSTs each one to the Make.com webhook via
 * SocialPublishDispatchService.dispatchTarget.
 *
 * Features:
 * - Advisory lock (43032) prevents overlapping executions across replicas
 * - Guard: skips the run when HOSPEDA_MAKE_API_KEY is absent (cannot dispatch)
 * - Per-target error isolation: one failed dispatch does not abort the batch
 * - dry-run mode: identifies eligible targets without calling dispatchTarget
 * - Outcome breakdown reported in result.details (dispatched / retry_scheduled /
 *   exhausted / skipped_no_webhook / skipped_locked)
 *
 * @see SPEC-254 T-049 / US-11
 * @module cron/jobs/social-publish-dispatch
 */

import { sql, withTransaction } from '@repo/db';
import { SocialPublishDispatchService } from '@repo/service-core';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for the social-publish-dispatch cron job.
 *
 * Uses `pg_try_advisory_xact_lock` (transaction-level, non-blocking) so the
 * lock auto-releases on commit/rollback and is safe under PgBouncer /
 * Coolify's pooled-client configuration (see `packages/db/docs/advisory-locks.md`).
 *
 * Key 43032 continues the non-billing 4300x series introduced in SPEC-215:
 *   43031 destination-weather-fetch  (SPEC-215)
 *   43032 social-publish-dispatch    ← this job (SPEC-254 T-049)
 */
const ADVISORY_LOCK_KEY = 43032;

/**
 * Discriminated union returned by the withTransaction callback so the outer
 * handler can distinguish lock-skip from real execution results.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

/**
 * Social publish dispatch cron job definition.
 *
 * Schedule: Every 5 minutes (`*\/5 * * * *`). Configurable in future via env.
 * Purpose: Push approved social post targets to Make.com for publication.
 */
export const socialPublishDispatchJob: CronJobDefinition = {
    name: 'social-publish-dispatch',
    description:
        'Dispatch approved social post targets to Make.com for publication (SPEC-254 US-11)',
    schedule: '*/5 * * * *', // Every 5 minutes
    enabled: true,
    timeoutMs: 120_000, // 2 minutes — allows up to ~3 sequential targets at 40s each

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting social publish dispatch', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        // Guard: cannot dispatch without the outbound Make.com API key.
        // HOSPEDA_MAKE_API_KEY is optional in the env schema because it is only
        // required once the Make.com publish route is live. When absent, log a
        // warning and exit cleanly so other cron jobs are not disrupted.
        if (!env.HOSPEDA_MAKE_API_KEY) {
            logger.warn(
                'social-publish-dispatch: HOSPEDA_MAKE_API_KEY is not set — skipping dispatch'
            );
            return {
                success: true,
                message: 'Skipped: HOSPEDA_MAKE_API_KEY is not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { skipped: true, reason: 'missing_make_api_key' }
            };
        }

        // Snapshot the env value we will pass into service methods.
        // Service-core must NEVER access env directly (testability constraint).
        const makeApiKey = env.HOSPEDA_MAKE_API_KEY;

        try {
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                // Prevent overlapping cron executions via PostgreSQL advisory lock.
                // Lock key 43032 is reserved for this job. Uses
                // pg_try_advisory_xact_lock (transaction-level) so the lock
                // auto-releases on commit/rollback and is safe under PgBouncer.
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const dispatchService = new SocialPublishDispatchService({ logger: apiLogger });

                const { targets } = await dispatchService.findEligibleTargets();

                logger.info('Found eligible targets for dispatch', {
                    count: targets.length,
                    dryRun
                });

                if (dryRun) {
                    const durationMs = Date.now() - startedAt.getTime();
                    logger.info(
                        `Dry run — would dispatch ${targets.length} target(s); no HTTP calls made`
                    );
                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run — ${targets.length} target(s) eligible for dispatch`,
                        processed: targets.length,
                        errors: 0,
                        durationMs,
                        details: {
                            dryRun: true,
                            eligibleCount: targets.length
                        }
                    };
                }

                // Outcome tallies
                // `published`  — Make responded SUCCESS synchronously; target is PUBLISHED.
                // `retry_scheduled` / `exhausted` — failure path.
                const outcomes: Record<string, number> = {
                    published: 0,
                    retry_scheduled: 0,
                    exhausted: 0,
                    skipped_no_webhook: 0,
                    skipped_locked: 0,
                    errored: 0
                };

                // Dispatch sequentially to avoid hammering Make.com.
                // One failure must not abort the remainder of the batch.
                for (const { target, post } of targets) {
                    try {
                        const result = await dispatchService.dispatchTarget({
                            target,
                            post,
                            makeApiKey
                        });
                        outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;

                        logger.info('Dispatched target', {
                            outcome: result.outcome,
                            retryCount: result.retryCount
                        });
                    } catch (targetError) {
                        outcomes.errored = (outcomes.errored ?? 0) + 1;
                        const msg =
                            targetError instanceof Error
                                ? targetError.message
                                : String(targetError);
                        logger.error('Failed to dispatch target — continuing batch', {
                            error: msg
                        });
                    }
                }

                const totalAttempted = targets.length;
                const totalErrors = (outcomes.errored ?? 0) + (outcomes.exhausted ?? 0);
                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Social publish dispatch completed', {
                    attempted: totalAttempted,
                    outcomes,
                    durationMs
                });

                return {
                    skipped: false,
                    success: totalErrors === 0,
                    message:
                        totalErrors === 0
                            ? `Published ${outcomes.published ?? 0} target(s) successfully`
                            : `Published with ${totalErrors} error(s) out of ${totalAttempted} target(s)`,
                    processed: totalAttempted,
                    errors: totalErrors,
                    durationMs,
                    details: { outcomes }
                };
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (cronResult.skipped) {
                apiLogger.warn(
                    'social-publish-dispatch cron: skipping — previous run still holds advisory lock'
                );
                return {
                    success: true,
                    message: 'Skipped: previous run still active (advisory lock not acquired)',
                    processed: 0,
                    errors: 0,
                    durationMs,
                    details: { skipped: true, reason: 'lock_not_acquired' }
                };
            }

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                details: cronResult.details
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Social publish dispatch failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to run social publish dispatch: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
    // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
    // transaction commit/rollback; withTransaction always commits or rolls back.
};
