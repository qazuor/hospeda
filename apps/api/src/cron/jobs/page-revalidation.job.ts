/**
 * Page Revalidation Cron Job
 *
 * Periodically triggers ISR (Incremental Static Regeneration) revalidation
 * for pages whose configured cron interval has elapsed since the last run.
 * Also performs stale detection for entities configured with autoRevalidateOnChange.
 * Runs every hour by default (configurable via HOSPEDA_REVALIDATION_CRON_SCHEDULE).
 *
 * Features:
 * - Interval-based revalidation per entity type (configurable per config row)
 * - Stale detection: re-triggers revalidation for entities not refreshed in 48 h
 * - Automatic cleanup of log entries older than the configured retention period
 * - Gracefully skips if RevalidationService is not initialized
 *
 * @module cron/jobs/page-revalidation
 */

import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationEntityType } from '@repo/schemas';
import { getRevalidationService } from '@repo/service-core';
import type { CronJobDefinition } from '../types.js';

/** Milliseconds per day — used to compute retention window dynamically */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 48 hours in milliseconds — stale detection window */
const STALE_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Page revalidation cron job definition.
 *
 * Schedule: configurable via HOSPEDA_REVALIDATION_CRON_SCHEDULE (default: every hour)
 * Purpose: Keep ISR-cached pages fresh by revalidating entity types on their configured intervals
 */
export const pageRevalidationJob: CronJobDefinition = {
    name: 'page-revalidation',
    description:
        'Trigger ISR revalidation for entity types based on configured cron intervals and stale detection',
    // pre-validation: must use process.env directly (module-level object literal, before validateApiEnv() runs)
    schedule: process.env.HOSPEDA_REVALIDATION_CRON_SCHEDULE ?? '0 * * * *',
    enabled: true,
    timeoutMs: 120000, // 2 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting page revalidation job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        const service = getRevalidationService();
        if (!service) {
            logger.warn('RevalidationService not initialized, skipping');
            return {
                success: true,
                message: 'RevalidationService not initialized — skipped',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startedAt.getTime(),
                details: { skipped: true, reason: 'service_not_initialized' }
            };
        }

        let revalidated = 0;
        let staleRevalidated = 0;
        let errors = 0;

        try {
            const configModel = new RevalidationConfigModel();
            const logModel = new RevalidationLogModel();

            const configs = await configModel.findAllEnabled();

            logger.info('Found enabled revalidation configs', { count: configs.length });

            // Track which entity types were already queued in this run so the
            // stale pass does not queue a type the interval pass already covered.
            const alreadyRevalidated = new Set<string>();

            // HOS-297: entity types are COLLECTED here and revalidated in one
            // batched call after both passes, instead of one call each. Every call
            // ends in a whole-zone purge, so the old shape fired one zone purge per
            // entity type per run.
            //
            // Those purges were `await`-sequential, so this is a waste and
            // rate-budget reduction — NOT the fix for the 403 seen in production.
            // That came from the per-entity debounce fan-out on the edit path,
            // fixed separately in RevalidationService. Worth doing anyway: a
            // whole-zone purge per entity type per hour is real cache churn and
            // real budget against the same endpoint.
            //
            // The two triggers stay separate so `revalidation_log` still
            // distinguishes 'cron' from 'stale'.
            const intervalDue: RevalidationEntityType[] = [];
            const staleDue: RevalidationEntityType[] = [];

            // --- Interval-based revalidation ---
            for (const config of configs) {
                try {
                    const lastEntry = await logModel.findLastCronEntry(config.entityType);
                    const intervalMs = config.cronIntervalMinutes * 60 * 1000;
                    const now = Date.now();
                    const lastRunTime = lastEntry?.createdAt.getTime() ?? 0;

                    if (now - lastRunTime >= intervalMs) {
                        logger.info('Interval elapsed, queueing entity type for revalidation', {
                            entityType: config.entityType,
                            intervalMinutes: config.cronIntervalMinutes,
                            lastRunAt: lastEntry?.createdAt.toISOString() ?? 'never'
                        });

                        // Queued, not revalidated yet — see the batch call below
                        // for why this run must end in a single purge (HOS-297).
                        // The counters are incremented from the dispatch outcome,
                        // NOT here: counting at queue time made `processed` report
                        // a full success on a run whose purge returned 403.
                        intervalDue.push(config.entityType as RevalidationEntityType);
                        alreadyRevalidated.add(config.entityType);
                    } else {
                        logger.debug('Interval not yet elapsed, skipping entity type', {
                            entityType: config.entityType,
                            remainingMs: intervalMs - (now - lastRunTime)
                        });
                    }
                } catch (error) {
                    errors++;
                    logger.error('Failed interval-based revalidation for entity type', {
                        entityType: config.entityType,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // --- Stale detection ---
            // For entities with autoRevalidateOnChange enabled, check if the last revalidation
            // is older than STALE_WINDOW_MS. If so, trigger an additional revalidation pass.
            // Skip entity types already revalidated in the interval pass above.
            for (const config of configs) {
                if (!config.autoRevalidateOnChange) continue;
                if (alreadyRevalidated.has(config.entityType)) {
                    logger.debug(
                        'Skipping stale detection — already revalidated in interval pass',
                        {
                            entityType: config.entityType
                        }
                    );
                    continue;
                }

                try {
                    const lastLog = await logModel.findLastCronEntry(config.entityType);
                    const isStale =
                        !lastLog || Date.now() - lastLog.createdAt.getTime() > STALE_WINDOW_MS;

                    if (isStale) {
                        logger.info('Stale entity type detected, queueing for revalidation', {
                            entityType: config.entityType,
                            lastLogAt: lastLog?.createdAt.toISOString() ?? 'never'
                        });

                        staleDue.push(config.entityType as RevalidationEntityType);
                    }
                } catch (error) {
                    errors++;
                    logger.error('Failed stale detection revalidation for entity type', {
                        entityType: config.entityType,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // --- Batched revalidation: at most TWO purges per run, not one per type ---
            //
            // Not merged into a single call because `trigger` is per-batch and the
            // 'cron' vs 'stale' distinction is what the log — and therefore the
            // next run's interval maths — is read on. Two purges for a run that
            // used to fire one per configured entity type.
            if (dryRun) {
                // Nothing is dispatched, so report what WOULD have been done.
                revalidated = intervalDue.length;
                staleRevalidated = staleDue.length;
            } else {
                // Each batch is wrapped separately so a failing 'cron' batch cannot
                // stop the 'stale' one, and so neither aborts the log cleanup below.
                // The per-config try/catch above no longer covers the purge, since
                // the purge no longer happens per config.
                for (const batch of [
                    { entityTypes: intervalDue, trigger: 'cron' as const },
                    { entityTypes: staleDue, trigger: 'stale' as const }
                ]) {
                    if (batch.entityTypes.length === 0) continue;

                    try {
                        const batchResults = await service.revalidateEntityTypesBatch({
                            entityTypes: batch.entityTypes,
                            trigger: batch.trigger
                        });

                        // The batch reports purge failures in its results rather than
                        // throwing (same contract as revalidateTags), so they have to
                        // be counted here or a failed purge would look like success.
                        const failed = batchResults.filter(({ results }) =>
                            results.some((result) => !result.success)
                        );
                        const succeeded = batchResults.length - failed.length;

                        if (batch.trigger === 'cron') {
                            revalidated += succeeded;
                        } else {
                            staleRevalidated += succeeded;
                        }

                        if (failed.length > 0) {
                            // One error per failed BATCH, not per entity type: a
                            // single 403 affects every type in the window and
                            // `errors` means "operations that failed".
                            errors++;
                            logger.error('Batched revalidation failed', {
                                trigger: batch.trigger,
                                entityTypes: failed.map(({ entityType }) => entityType),
                                error: failed[0]?.results.find((result) => !result.success)?.error
                            });
                        }
                    } catch (error) {
                        errors++;
                        logger.error('Batched revalidation threw', {
                            trigger: batch.trigger,
                            entityTypes: batch.entityTypes,
                            error: error instanceof Error ? error.message : String(error)
                        });
                    }
                }
            }

            if (intervalDue.length > 0 || staleDue.length > 0) {
                logger.info('Batched revalidation dispatched', {
                    intervalEntityTypes: intervalDue.length,
                    staleEntityTypes: staleDue.length,
                    revalidated,
                    staleRevalidated,
                    errors,
                    dryRun
                });
            }

            // --- Cleanup old log entries ---
            const retentionDays = service.getLogRetentionDays();
            const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
            let deleted = 0;

            if (!dryRun) {
                deleted = await logModel.deleteOlderThan(cutoff);
            }

            logger.info('Cleaned up old revalidation log entries', {
                deleted,
                cutoffDate: cutoff.toISOString(),
                dryRun
            });

            const durationMs = Date.now() - startedAt.getTime();
            const total = revalidated + staleRevalidated;

            logger.info('Page revalidation job completed', {
                revalidated,
                staleRevalidated,
                errors,
                deleted,
                durationMs
            });

            return {
                success: true,
                message: `Revalidated ${revalidated} entity types (${staleRevalidated} stale), cleaned up ${deleted} old log entries (${errors} errors)`,
                processed: total,
                errors,
                durationMs,
                details: {
                    revalidated,
                    staleRevalidated,
                    deleted,
                    dryRun
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            errors++;

            logger.error('Page revalidation job failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to run page revalidation: ${errorMessage}`,
                processed: revalidated + staleRevalidated,
                errors,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};
