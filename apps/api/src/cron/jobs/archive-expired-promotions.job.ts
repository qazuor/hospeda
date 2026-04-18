/**
 * Archive Expired Promotions Cron Job
 *
 * Automatically archives OwnerPromotions whose `validUntil` has passed.
 * Runs hourly to keep expired promotions out of the ACTIVE state without
 * manual intervention (SPEC-063 AC-007-01).
 *
 * Features:
 * - Selects up to 100 ACTIVE promotions with expired `validUntil` per run
 * - Batch UPDATE to `lifecycleState = 'ARCHIVED'`
 * - Advisory lock (43010) prevents overlapping executions
 * - Dry-run support reports the count without modifying data
 * - System-initiated: `updatedById` is set to NULL (no SYSTEM_USER_ID exists)
 *
 * @module cron/jobs/archive-expired-promotions
 */

import { and, eq, isNotNull, isNull, lt, ownerPromotions, sql, withTransaction } from '@repo/db';
import * as Sentry from '@sentry/node';
import { inArray } from 'drizzle-orm';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Maximum number of promotions archived per run.
 * Hourly schedule ensures backlog is processed within a bounded window.
 */
const BATCH_LIMIT = 100;

/**
 * Advisory lock ID reserved for this cron job.
 * Registered in `packages/db/docs/advisory-locks.md`.
 */
const ADVISORY_LOCK_ID = 43010;

/**
 * Structured logging source tag for this cron job.
 */
const LOG_SOURCE = 'cron:archive-expired-promotions';

/**
 * Discriminated union returned by the transaction callback so the outer handler
 * can distinguish between advisory-lock skips and actual execution outcomes.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly dryRun: boolean;
          readonly processed: number;
      };

/**
 * Archive expired OwnerPromotions cron job definition.
 *
 * Schedule: Every hour at minute 0 (`0 * * * *`).
 * Purpose: Transition ACTIVE promotions whose `validUntil` has passed to ARCHIVED.
 */
export const archiveExpiredPromotionsJob: CronJobDefinition = {
    name: 'archive-expired-promotions',
    description: 'Archive OwnerPromotions with lifecycleState=ACTIVE whose validUntil has passed',
    schedule: '0 * * * *',
    enabled: true,
    timeoutMs: 60_000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting archive-expired-promotions job', {
            source: LOG_SOURCE,
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const result = await withTransaction<CronTransactionResult>(async (tx) => {
                // Acquire a transaction-level advisory lock to prevent overlapping runs.
                // `pg_try_advisory_xact_lock` is non-blocking and auto-releases on
                // commit/rollback — required by project policy (Neon/PgBouncer compatibility,
                // see packages/db/docs/advisory-locks.md).
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) as acquired`
                );
                const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)
                    ?.acquired;

                if (!acquired) {
                    return { skipped: true };
                }

                await tx.execute(sql`SET LOCAL statement_timeout = '60000'`);

                const expired = await tx
                    .select({ id: ownerPromotions.id })
                    .from(ownerPromotions)
                    .where(
                        and(
                            eq(ownerPromotions.lifecycleState, 'ACTIVE'),
                            isNotNull(ownerPromotions.validUntil),
                            lt(ownerPromotions.validUntil, sql`NOW()`),
                            isNull(ownerPromotions.deletedAt)
                        )
                    )
                    .limit(BATCH_LIMIT);

                if (dryRun) {
                    logger.info('Dry run mode - would archive expired promotions', {
                        source: LOG_SOURCE,
                        count: expired.length
                    });
                    return { skipped: false, dryRun: true, processed: expired.length };
                }

                if (expired.length === 0) {
                    logger.info('No expired promotions to archive', {
                        source: LOG_SOURCE,
                        count: 0
                    });
                    return { skipped: false, dryRun: false, processed: 0 };
                }

                const expiredIds = expired.map((row) => row.id);

                // Batch UPDATE to ARCHIVED. `updatedById` is explicitly NULL because this is
                // a system-initiated action and no SYSTEM_USER_ID constant exists in the
                // codebase yet (SPEC-063 AC-007-01). If one is introduced later, update here.
                await tx
                    .update(ownerPromotions)
                    .set({
                        lifecycleState: 'ARCHIVED',
                        updatedAt: new Date(),
                        updatedById: null
                    })
                    .where(inArray(ownerPromotions.id, expiredIds));

                logger.info('Archived expired promotions', {
                    source: LOG_SOURCE,
                    count: expiredIds.length
                });

                return { skipped: false, dryRun: false, processed: expiredIds.length };
            });

            const durationMs = Date.now() - startedAt.getTime();

            if (result.skipped) {
                apiLogger.warn(
                    'archive-expired-promotions cron: skipping — previous run still holds advisory lock'
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

            if (result.dryRun) {
                return {
                    success: true,
                    message: `Dry run: would archive ${result.processed} expired promotions`,
                    processed: result.processed,
                    errors: 0,
                    durationMs,
                    details: { dryRun: true, wouldArchive: result.processed }
                };
            }

            return {
                success: true,
                message: `Archived ${result.processed} expired promotions`,
                processed: result.processed,
                errors: 0,
                durationMs,
                details: { archived: result.processed }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            Sentry.captureException(error, {
                tags: { cronJob: 'archive-expired-promotions', phase: 'top-level' }
            });

            logger.error('archive-expired-promotions job failed', {
                source: LOG_SOURCE,
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to archive expired promotions: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
