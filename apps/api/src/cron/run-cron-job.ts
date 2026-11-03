import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
import { HEALTHCHECKS_MONITORED_JOBS, pingHealthchecks } from '../utils/healthchecks-ping';
import { apiLogger } from '../utils/logger';
import { withCronLock } from './cron-lock';
import { recordCronRun } from './record-run';
import { runCronHandlerInBackground } from './traffic';
import type { CronJobContext, CronJobDefinition, CronJobResult } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const monitoredJobs: ReadonlySet<string> = new Set(HEALTHCHECKS_MONITORED_JOBS);

/** Result returned once an exclusive job's lock decision is known. */
export type RunCronJobDecision =
    | {
          readonly started: true;
          readonly runId: string;
          readonly completion: Promise<CronJobResult>;
      }
    | { readonly started: false; readonly holderRunId: string | null };

/** Build the run context with mode-specific log names and cooperative budget fields. */
export function createCronJobContext(args: {
    readonly jobName: string;
    readonly executionMode: 'scheduled' | 'manual';
    readonly startedAt: Date;
    readonly runId: string;
    readonly correlationId: string;
    readonly signal: AbortSignal;
    readonly deadlineAt: Date;
    readonly dryRun: boolean;
}): CronJobContext {
    const prefix = args.executionMode === 'scheduled' ? 'CRON' : 'ADMIN-CRON';
    const ids = { runId: args.runId, correlationId: args.correlationId };
    return {
        logger: {
            info: (message, data) =>
                apiLogger.info({
                    message: `[${prefix}:${args.jobName}] ${message}`,
                    ...ids,
                    ...data
                }),
            warn: (message, data) =>
                apiLogger.warn({
                    message: `[${prefix}:${args.jobName}] ${message}`,
                    ...ids,
                    ...data
                }),
            error: (message, data, options) =>
                apiLogger.error(
                    { message: `[${prefix}:${args.jobName}] ${message}`, ...ids, ...data },
                    undefined,
                    options?.capture ? { capture: true } : undefined
                ),
            debug: (message, data) =>
                apiLogger.debug({
                    message: `[${prefix}:${args.jobName}] ${message}`,
                    ...ids,
                    ...data
                })
        },
        startedAt: args.startedAt,
        runId: args.runId,
        correlationId: args.correlationId,
        signal: args.signal,
        deadlineAt: args.deadlineAt,
        dryRun: args.dryRun
    };
}

/** Execute one cron handler through the common scheduled/manual lifecycle. */
export async function runCronJob(args: {
    readonly job: CronJobDefinition;
    readonly executionMode: 'scheduled' | 'manual';
    readonly dryRun: boolean;
    readonly scheduleExpression?: string;
}): Promise<RunCronJobDecision> {
    const { job, executionMode, dryRun } = args;
    const runId = randomUUID();
    const correlationId = randomUUID();
    const startedAt = new Date();
    const timeoutMs = job.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const budgetMs = job.budgetMs ?? (job.exclusive ? Math.floor(timeoutMs * 0.9) : timeoutMs);
    const controller = new AbortController();
    const deadlineAt = new Date(startedAt.getTime() + budgetMs);
    const ctx = createCronJobContext({
        jobName: job.name,
        executionMode,
        startedAt,
        runId,
        correlationId,
        signal: controller.signal,
        deadlineAt,
        dryRun
    });
    const monitored = executionMode === 'scheduled' && monitoredJobs.has(job.name);

    const startHandler = (): Promise<CronJobResult> => runCronHandlerInBackground({ job, ctx });
    let handlerPromise: Promise<CronJobResult>;
    if (job.exclusive) {
        const lock = await withCronLock({ name: job.name, runId, handler: startHandler });
        if (!lock.acquired) {
            const result: CronJobResult = {
                success: true,
                message: 'Skipped because another run holds the cron lock',
                processed: 0,
                errors: 0,
                durationMs: 0,
                details: { runId, skipped: 'overlap', holderRunId: lock.holderRunId }
            };
            ctx.logger.info('Skipped overlapping run', { holderRunId: lock.holderRunId });
            await recordCronRun({
                jobName: job.name,
                executionMode,
                dryRun,
                startedAt,
                finishedAt: new Date(),
                result
            });
            return { started: false, holderRunId: lock.holderRunId };
        }
        handlerPromise = lock.completion;
    } else {
        handlerPromise = startHandler();
    }

    if (monitored) void pingHealthchecks({ job: job.name, signal: 'start' }).catch(() => undefined);
    void handlerPromise.catch(() => undefined);
    const budgetTimer = setTimeout(() => controller.abort(), budgetMs);
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimer = setTimeout(
            () => reject(new Error(`Job execution timeout after ${timeoutMs}ms`)),
            timeoutMs
        );
    });
    const completion = (async (): Promise<CronJobResult> => {
        try {
            const result = await Promise.race([handlerPromise, timeoutPromise]);
            const recordedResult: CronJobResult = {
                ...result,
                details: { ...result.details, runId }
            };
            if (executionMode === 'scheduled') {
                apiLogger.info({
                    message: `[cron] completed: ${job.name}`,
                    success: result.success,
                    processed: result.processed,
                    errors: result.errors,
                    durationMs: Date.now() - startedAt.getTime()
                });
                if (monitored)
                    void pingHealthchecks({
                        job: job.name,
                        signal: result.success ? 'success' : 'fail'
                    }).catch(() => undefined);
                if (!result.success) {
                    Sentry.captureException(
                        new Error(`[cron] soft-failure: ${job.name} — ${result.errors} error(s)`),
                        {
                            level: 'warning',
                            tags: {
                                module: 'cron',
                                job_name: job.name,
                                event_type: 'cron_soft_failure'
                            },
                            contexts: {
                                cron: {
                                    jobName: job.name,
                                    schedule: args.scheduleExpression ?? job.schedule,
                                    durationMs: Date.now() - startedAt.getTime(),
                                    errors: result.errors,
                                    processed: result.processed,
                                    ...(result.details ? { details: result.details } : {})
                                }
                            }
                        }
                    );
                }
            }
            await recordCronRun({
                jobName: job.name,
                executionMode,
                dryRun,
                startedAt,
                finishedAt: new Date(),
                result: recordedResult
            });
            return recordedResult;
        } catch (error) {
            if (executionMode === 'scheduled') {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                apiLogger.error({
                    message: `[cron] failed: ${job.name}`,
                    error: errorMessage,
                    durationMs: Date.now() - startedAt.getTime()
                });
                Sentry.captureException(error instanceof Error ? error : new Error(errorMessage), {
                    level: 'error',
                    tags: { module: 'cron', job_name: job.name, event_type: 'cron_failure' },
                    contexts: {
                        cron: {
                            jobName: job.name,
                            schedule: args.scheduleExpression ?? job.schedule,
                            durationMs: Date.now() - startedAt.getTime()
                        }
                    }
                });
                if (monitored)
                    void pingHealthchecks({ job: job.name, signal: 'fail' }).catch(() => undefined);
            }
            await recordCronRun({
                jobName: job.name,
                executionMode,
                dryRun,
                startedAt,
                finishedAt: new Date(),
                error
            });
            throw error;
        } finally {
            clearTimeout(budgetTimer);
            if (timeoutTimer) clearTimeout(timeoutTimer);
        }
    })();
    return { started: true, runId, completion };
}
