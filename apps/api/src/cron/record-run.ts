/**
 * Cron run recording (fire-and-forget).
 *
 * Persists the outcome of a cron execution into `cron_runs` via {@link CronRunService}.
 * This is observability: a failure to record MUST NEVER alter the job's own outcome,
 * so every path here swallows its own errors (logged + reported to Sentry) and the
 * exported {@link recordCronRun} never throws.
 *
 * @module cron/record-run
 */

import type { CronRunExecutionMode } from '@repo/schemas';
import { CronRunService } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../utils/logger';
import type { CronJobResult } from './types';

/** Single shared service instance — recording is stateless. */
const cronRunService = new CronRunService({ logger: apiLogger });

/** Substring marker used by both execution sites for the wall-clock timeout error. */
const TIMEOUT_MARKER = 'execution timeout';

/**
 * Records the outcome of a single cron execution. Never throws.
 *
 * Exactly one of `result` (handler resolved) or `error` (handler threw / timed out)
 * is expected. The status is derived as:
 * - `error` whose message contains the timeout marker → `timeout`
 * - any other `error`, or a `result` with `success: false` → `failed`
 * - a `result` with `success: true` → `success`
 *
 * @param input.jobName - Registered job name.
 * @param input.executionMode - `scheduled` (bootstrap tick) or `manual` (admin trigger).
 * @param input.dryRun - Whether the run was a dry-run.
 * @param input.startedAt - When the handler started.
 * @param input.finishedAt - When the handler settled (defaults to now).
 * @param input.result - The handler result, when it resolved.
 * @param input.error - The thrown value, when it failed or timed out.
 */
export const recordCronRun = async (input: {
    jobName: string;
    executionMode: CronRunExecutionMode;
    dryRun: boolean;
    startedAt: Date;
    finishedAt?: Date;
    result?: CronJobResult;
    error?: unknown;
}): Promise<void> => {
    try {
        const finishedAt = input.finishedAt ?? new Date();
        const durationMs = Math.max(0, finishedAt.getTime() - input.startedAt.getTime());

        let status: 'success' | 'failed' | 'timeout';
        let errorMessage: string | null = null;

        if (input.error !== undefined) {
            const message =
                input.error instanceof Error ? input.error.message : String(input.error);
            status = message.toLowerCase().includes(TIMEOUT_MARKER) ? 'timeout' : 'failed';
            errorMessage = message;
        } else {
            status = input.result?.success ? 'success' : 'failed';
        }

        await cronRunService.recordRun({
            data: {
                jobName: input.jobName,
                status,
                startedAt: input.startedAt,
                finishedAt,
                durationMs,
                processed: input.result?.processed ?? 0,
                errors: input.result?.errors ?? (status === 'success' ? 0 : 1),
                executionMode: input.executionMode,
                dryRun: input.dryRun,
                errorMessage,
                details: input.result?.details
            }
        });
    } catch (recordError) {
        const message = recordError instanceof Error ? recordError.message : String(recordError);
        apiLogger.error({
            message: `[cron] failed to record run history for ${input.jobName}`,
            error: message
        });
        Sentry.captureException(recordError instanceof Error ? recordError : new Error(message), {
            level: 'warning',
            tags: {
                module: 'cron',
                event_type: 'cron_run_record_failure',
                job_name: input.jobName
            }
        });
    }
};
