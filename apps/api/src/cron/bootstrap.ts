/**
 * Cron Scheduler Bootstrap
 *
 * Schedules every enabled cron job in-process via `node-cron` and invokes
 * each handler directly (no HTTP hop). Configured by the
 * `HOSPEDA_CRON_ADAPTER` env var:
 *
 * - `node-cron` — the production VPS path: spin up node-cron schedules
 *   and call `job.handler(ctx)` on each tick.
 * - `manual` — used in dev/tests/CI when something else (admin panel,
 *   tests, an operator) is responsible for triggering jobs.
 *
 * Every schedule is registered on the wall clock of the market time zone,
 * `America/Argentina/Buenos_Aires`, through node-cron's per-task `timezone`
 * option (HOS-1424, NUCLEO/07 §3): `0 8 * * *` fires at 08:00 in Buenos
 * Aires whatever zone the process runs in. `TZ` is never set or read.
 *
 * Every tick gets its own run id and run correlation (NUCLEO/08 §2.3).
 *
 * @module cron/bootstrap
 */

import { MARKET_TIMEZONE } from '@repo/utils';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import { getEnabledCronJobs } from './registry';
import { runCronJob } from './run-cron-job';

/** node-cron options shared by every registered schedule. */
export const CRON_SCHEDULE_OPTIONS = { timezone: MARKET_TIMEZONE, noOverlap: true } as const;

/**
 * Start the cron scheduler.
 *
 * @example
 * ```typescript
 * if (process.env.NODE_ENV !== 'test') {
 *   await startCronScheduler();
 * }
 * ```
 */
export const startCronScheduler = async (): Promise<void> => {
    const adapter = env.HOSPEDA_CRON_ADAPTER;

    if (adapter !== 'node-cron') {
        apiLogger.info({
            message: `[cron] adapter=${adapter} — in-process scheduling skipped`
        });
        return;
    }

    let nodeCron: typeof import('node-cron');
    try {
        nodeCron = await import('node-cron');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        apiLogger.error({
            message:
                '[cron] Failed to load node-cron — in-process scheduling disabled. ' +
                'Install with: pnpm add node-cron @types/node-cron',
            error: errorMessage
        });
        return;
    }

    const enabledJobs = getEnabledCronJobs();
    if (enabledJobs.length === 0) {
        apiLogger.warn({ message: '[cron] No enabled jobs found — scheduler not started' });
        return;
    }

    apiLogger.info({ message: `[cron] adapter=node-cron jobs=${enabledJobs.length} initialized` });

    for (const job of enabledJobs) {
        try {
            let scheduleExpression = job.schedule;
            if (job.resolveSchedule) {
                try {
                    scheduleExpression = await job.resolveSchedule();
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    apiLogger.warn({
                        message: `[cron] resolveSchedule failed for ${job.name} — falling back to default schedule`,
                        error: errorMessage,
                        fallbackSchedule: job.schedule
                    });
                }
            }

            nodeCron.schedule(
                scheduleExpression,
                async () => {
                    apiLogger.info({ message: `[cron] tick: ${job.name}` });
                    try {
                        const decision = await runCronJob({
                            job,
                            executionMode: 'scheduled',
                            dryRun: false,
                            scheduleExpression
                        });
                        if (decision.started) await decision.completion;
                    } catch (error) {
                        const errorMessage =
                            error instanceof Error ? error.message : 'Unknown error';
                        apiLogger.error({
                            message: `[cron] tick failed before completion: ${job.name}`,
                            error: errorMessage
                        });
                    }
                },
                CRON_SCHEDULE_OPTIONS
            );

            apiLogger.info({
                message: `[cron] schedule registered: ${job.name} @ ${scheduleExpression} (${MARKET_TIMEZONE})`,
                description: job.description
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            apiLogger.error({
                message: `[cron] failed to register schedule: ${job.name}`,
                error: errorMessage
            });
        }
    }
};
