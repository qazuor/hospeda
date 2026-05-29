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
 * @module cron/bootstrap
 */

import * as Sentry from '@sentry/node';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import { recordCronRun } from './record-run';
import { getEnabledCronJobs } from './registry';
import type { CronJobContext, CronJobDefinition, CronJobResult } from './types';

/** Default per-job execution timeout (matches the value used by admin manual triggers). */
const DEFAULT_JOB_TIMEOUT_MS = 30_000;

/**
 * Builds the per-tick context handed to a job handler.
 *
 * Each log call is namespaced with the job name so log scraping by
 * `[CRON:<name>]` works the same as on the admin manual trigger path.
 */
function buildContext(jobName: string): CronJobContext {
    return {
        logger: {
            info: (message, data) =>
                apiLogger.info({ message: `[CRON:${jobName}] ${message}`, ...data }),
            warn: (message, data) =>
                apiLogger.warn({ message: `[CRON:${jobName}] ${message}`, ...data }),
            error: (message, data) =>
                apiLogger.error({ message: `[CRON:${jobName}] ${message}`, ...data }),
            debug: (message, data) =>
                apiLogger.debug({ message: `[CRON:${jobName}] ${message}`, ...data })
        },
        startedAt: new Date(),
        dryRun: false
    };
}

/** Runs a single job handler with a wall-clock timeout. */
async function runJobWithTimeout(
    job: CronJobDefinition,
    timeoutMs: number
): Promise<CronJobResult> {
    const ctx = buildContext(job.name);
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
            () => reject(new Error(`Job execution timeout after ${timeoutMs}ms`)),
            timeoutMs
        );
    });
    return Promise.race([job.handler(ctx), timeoutPromise]);
}

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
            nodeCron.schedule(job.schedule, async () => {
                const startTime = Date.now();
                apiLogger.info({ message: `[cron] tick: ${job.name}` });
                try {
                    const result = await runJobWithTimeout(
                        job,
                        job.timeoutMs ?? DEFAULT_JOB_TIMEOUT_MS
                    );
                    apiLogger.info({
                        message: `[cron] completed: ${job.name}`,
                        success: result.success,
                        processed: result.processed,
                        errors: result.errors,
                        durationMs: Date.now() - startTime
                    });
                    // Fire-and-forget: never alters the job outcome.
                    await recordCronRun({
                        jobName: job.name,
                        executionMode: 'scheduled',
                        dryRun: false,
                        startedAt: new Date(startTime),
                        finishedAt: new Date(),
                        result
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    apiLogger.error({
                        message: `[cron] failed: ${job.name}`,
                        error: errorMessage,
                        durationMs: Date.now() - startTime
                    });

                    // Capture to Sentry with consistent tags so the Sentry alert
                    // rules in docs/billing/sentry-alerts-runbook.md can match.
                    // Tags pinned by the alert configuration: module=cron,
                    // job_name=<name>. The dunning job carries an extra
                    // event_type=dunning_failure tag for its dedicated alert.
                    Sentry.captureException(
                        error instanceof Error ? error : new Error(errorMessage),
                        {
                            level: 'error',
                            tags: {
                                module: 'cron',
                                job_name: job.name,
                                ...(job.name === 'dunning'
                                    ? { event_type: 'dunning_failure' }
                                    : { event_type: 'cron_failure' })
                            },
                            contexts: {
                                cron: {
                                    jobName: job.name,
                                    schedule: job.schedule,
                                    durationMs: Date.now() - startTime
                                }
                            }
                        }
                    );

                    // Fire-and-forget: record the failure/timeout outcome.
                    await recordCronRun({
                        jobName: job.name,
                        executionMode: 'scheduled',
                        dryRun: false,
                        startedAt: new Date(startTime),
                        finishedAt: new Date(),
                        error
                    });
                }
            });

            apiLogger.info({
                message: `[cron] schedule registered: ${job.name} @ ${job.schedule}`,
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
