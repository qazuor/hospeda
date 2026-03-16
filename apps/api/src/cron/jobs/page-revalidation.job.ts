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
 * - Automatic cleanup of log entries older than 30 days
 * - Gracefully skips if RevalidationService is not initialized
 *
 * @module cron/jobs/page-revalidation
 */

import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationEntityType } from '@repo/schemas';
import { getRevalidationService } from '@repo/service-core';
import type { CronJobDefinition } from '../types.js';

/** 30 days in milliseconds — retention window for revalidation log entries */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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

            // Track which entity types were already revalidated in this run
            // to avoid double-revalidation when both interval and stale checks match.
            const alreadyRevalidated = new Set<string>();

            // --- Interval-based revalidation ---
            for (const config of configs) {
                try {
                    const lastEntry = await logModel.findLastCronEntry(config.entityType);
                    const intervalMs = config.cronIntervalMinutes * 60 * 1000;
                    const now = Date.now();
                    const lastRunTime = lastEntry?.createdAt.getTime() ?? 0;

                    if (now - lastRunTime >= intervalMs) {
                        logger.info('Interval elapsed, revalidating entity type', {
                            entityType: config.entityType,
                            intervalMinutes: config.cronIntervalMinutes,
                            lastRunAt: lastEntry?.createdAt.toISOString() ?? 'never'
                        });

                        if (!dryRun) {
                            await service.revalidateByEntityType(
                                config.entityType as RevalidationEntityType
                            );
                        }

                        alreadyRevalidated.add(config.entityType);
                        revalidated++;
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
                        logger.info('Stale entity type detected, triggering revalidation', {
                            entityType: config.entityType,
                            lastLogAt: lastLog?.createdAt.toISOString() ?? 'never'
                        });

                        if (!dryRun) {
                            await service.revalidateByEntityType(
                                config.entityType as RevalidationEntityType
                            );
                        }

                        staleRevalidated++;
                    }
                } catch (error) {
                    errors++;
                    logger.error('Failed stale detection revalidation for entity type', {
                        entityType: config.entityType,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            // --- Cleanup old log entries ---
            const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);
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
