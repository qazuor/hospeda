/**
 * Admin Cron Job Routes
 *
 * Provides admin-authenticated endpoints for viewing and manually triggering
 * registered cron jobs. These routes require admin-level access and use the
 * SYSTEM_MAINTENANCE_MODE permission.
 *
 * Routes:
 * - GET  /api/v1/admin/cron           - List all registered cron jobs
 * - POST /api/v1/admin/cron/:jobName  - Manually trigger a cron job
 *
 * @module routes/cron-admin
 */

import { type CronCategory, CronJobsAdminListSchema, PermissionEnum } from '@repo/schemas';
import { CronRunService } from '@repo/service-core';
import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue/i18n';
import type { Context } from 'hono';
import { z } from 'zod';
import { recordCronRun } from '../../cron/record-run';
import { cronJobs, getCronJob } from '../../cron/registry';
import { CRON_SCHEDULES } from '../../cron/schedules.manifest';
import type { CronJobContext, CronJobResult } from '../../cron/types';
import type { AppBindings } from '../../types';
import { getActorFromContext } from '../../utils/actor';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';
import { cronRunSummaryRoute, getCronRunByIdRoute, listCronRunsRoute } from './runs';

// ─── Response Schemas ────────────────────────────────────────────────────────

/** Enriched cron jobs list response (name + displayName + category + last/next run). */
const cronJobsListDataSchema = CronJobsAdminListSchema;

/** Lazy singleton for the cron-run service (last-run lookups). */
const cronRunService = (() => {
    let instance: CronRunService | null = null;
    return () => {
        if (!instance) {
            instance = new CronRunService({ logger: apiLogger });
        }
        return instance;
    };
})();

/** Presentation metadata (displayName + category) keyed by job name. */
const cronMetaByName = new Map(CRON_SCHEDULES.map((entry) => [entry.name, entry]));

/** Renders a cron expression in human-readable Spanish; falls back to the raw expr. */
const humanizeSchedule = (expr: string): string => {
    try {
        return cronstrue.toString(expr, { locale: 'es', use24HourTimeFormat: true });
    } catch {
        return expr;
    }
};

/** Computes the next run for an enabled job; null when disabled or unparseable. */
const computeNextRun = (expr: string, enabled: boolean): string | null => {
    if (!enabled) return null;
    try {
        return CronExpressionParser.parse(expr).next().toDate().toISOString();
    } catch {
        return null;
    }
};

/**
 * Schema for the cron job execution result response data
 */
const cronJobExecutionDataSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    processed: z.number(),
    errors: z.number(),
    durationMs: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
    jobName: z.string(),
    dryRun: z.boolean(),
    executedAt: z.string()
});

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * Handler for listing all registered cron jobs.
 * Extracted for testing purposes.
 *
 * @returns Object containing all registered cron jobs with metadata
 */
export const listCronJobsHandler = async (
    c: Context<AppBindings>
): Promise<z.infer<typeof cronJobsListDataSchema>> => {
    const actor = getActorFromContext(c);

    // Last run per job (best-effort: a failure here must not break the listing).
    let lastRunByJob = new Map<
        string,
        { status: 'success' | 'failed' | 'timeout'; finishedAt: Date }
    >();
    const summary = await cronRunService().getSummary({ actor });
    if (summary.data) {
        lastRunByJob = new Map(
            summary.data.lastRuns.map((run) => [
                run.jobName,
                { status: run.status, finishedAt: run.finishedAt }
            ])
        );
    }

    const jobList = cronJobs.map((job) => {
        const meta = cronMetaByName.get(job.name);
        const lastRun = lastRunByJob.get(job.name);
        const category: CronCategory = meta?.category ?? 'system';
        return {
            name: job.name,
            displayName: meta?.displayName ?? job.name,
            category,
            description: job.description,
            schedule: job.schedule,
            scheduleHuman: humanizeSchedule(job.schedule),
            enabled: job.enabled,
            nextRunAt: computeNextRun(job.schedule, job.enabled),
            lastRun: lastRun ?? null
        };
    });

    return {
        jobs: jobList,
        totalJobs: jobList.length,
        enabledJobs: jobList.filter((job) => job.enabled).length
    };
};

/**
 * Handler for triggering a cron job by name.
 * Extracted for testing purposes.
 *
 * @param _c - Hono context
 * @param params - Route params containing jobName
 * @param _body - Request body (unused)
 * @param query - Query params containing optional dryRun flag
 * @returns Execution result with timing and outcome details
 */
export const triggerCronJobHandler = async (
    _c: Context<AppBindings>,
    params: Record<string, unknown>,
    _body: Record<string, unknown>,
    query?: Record<string, unknown>
): Promise<z.infer<typeof cronJobExecutionDataSchema>> => {
    const jobName = params.jobName as string;
    const dryRun = query?.dryRun === 'true' || query?.dryRun === true;

    const job = getCronJob(jobName);

    if (!job) {
        throw Object.assign(new Error(`Cron job not found: ${jobName}`), {
            statusCode: 404,
            code: 'NOT_FOUND'
        });
    }

    if (!job.enabled) {
        throw Object.assign(new Error(`Cron job is disabled: ${jobName}`), {
            statusCode: 400,
            code: 'JOB_DISABLED'
        });
    }

    const startTime = Date.now();
    const startedAt = new Date();

    const jobContext: CronJobContext = {
        logger: {
            info: (message: string, data?: Record<string, unknown>) => {
                apiLogger.info({ message: `[ADMIN-CRON:${jobName}] ${message}`, ...data });
            },
            warn: (message: string, data?: Record<string, unknown>) => {
                apiLogger.warn({ message: `[ADMIN-CRON:${jobName}] ${message}`, ...data });
            },
            error: (message: string, data?: Record<string, unknown>) => {
                apiLogger.error({ message: `[ADMIN-CRON:${jobName}] ${message}`, ...data });
            },
            debug: (message: string, data?: Record<string, unknown>) => {
                apiLogger.debug({ message: `[ADMIN-CRON:${jobName}] ${message}`, ...data });
            }
        },
        startedAt,
        dryRun
    };

    const timeoutMs = job.timeoutMs ?? 30000;
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Job execution timeout after ${timeoutMs}ms`));
        }, timeoutMs);
    });

    let result: CronJobResult;
    try {
        result = await Promise.race([job.handler(jobContext), timeoutPromise]);
    } catch (error) {
        // Fire-and-forget: record the failure/timeout, then preserve the HTTP error.
        await recordCronRun({
            jobName,
            executionMode: 'manual',
            dryRun,
            startedAt,
            finishedAt: new Date(),
            error
        });
        throw error;
    }

    const durationMs = Date.now() - startTime;

    apiLogger.info({
        message: `[ADMIN-CRON:${jobName}] Completed`,
        success: result.success,
        processed: result.processed,
        errors: result.errors,
        durationMs,
        dryRun
    });

    // Fire-and-forget: record the successful (or success:false) outcome.
    await recordCronRun({
        jobName,
        executionMode: 'manual',
        dryRun,
        startedAt,
        finishedAt: new Date(),
        result
    });

    return {
        ...result,
        jobName,
        dryRun,
        executedAt: startedAt.toISOString()
    };
};

// ─── Route Definitions ───────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/cron
 * List all registered cron jobs with their status and schedule information.
 * Requires SYSTEM_MAINTENANCE_MODE permission.
 */
const listCronJobsRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'List cron jobs',
    description:
        'Returns all registered cron jobs with their schedule, enabled status, and description.',
    tags: ['Cron'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    responseSchema: cronJobsListDataSchema,
    handler: async (c) => listCronJobsHandler(c as Context<AppBindings>)
});

/**
 * POST /api/v1/admin/cron/:jobName
 * Manually trigger a registered cron job by name.
 * Supports optional dry-run mode via ?dryRun=true query param.
 * Requires SYSTEM_MAINTENANCE_MODE permission.
 */
const triggerCronJobRoute = createAdminRoute({
    method: 'post',
    path: '/{jobName}',
    summary: 'Trigger cron job',
    description:
        'Manually executes a registered cron job. Use ?dryRun=true to simulate without making changes.',
    tags: ['Cron'],
    requiredPermissions: [PermissionEnum.SYSTEM_MAINTENANCE_MODE],
    requestParams: { jobName: z.string().min(1) },
    requestQuery: { dryRun: z.coerce.boolean().optional().default(false) },
    responseSchema: cronJobExecutionDataSchema,
    handler: async (c, params, body, query) =>
        triggerCronJobHandler(
            c as Context<AppBindings>,
            params,
            body,
            query as Record<string, unknown> | undefined
        )
});

// ─── Router Assembly ─────────────────────────────────────────────────────────

const app = createRouter();

app.route('/', listCronJobsRoute);
// Run-history reads (SPEC-161). `/runs/summary` is registered before `/runs/{id}`
// so the literal segment is not captured as an id param.
app.route('/', listCronRunsRoute);
app.route('/', cronRunSummaryRoute);
app.route('/', getCronRunByIdRoute);
app.route('/', triggerCronJobRoute);

export { app as adminCronRoutes };
