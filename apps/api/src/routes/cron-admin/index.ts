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

import { PermissionEnum } from '@repo/schemas';
import type { Context } from 'hono';
import { z } from 'zod';
import { cronJobs, getCronJob } from '../../cron/registry';
import type { CronJobContext, CronJobResult } from '../../cron/types';
import type { AppBindings } from '../../types';
import { createRouter } from '../../utils/create-app';
import { apiLogger } from '../../utils/logger';
import { createAdminRoute } from '../../utils/route-factory';

// ─── Response Schemas ────────────────────────────────────────────────────────

/**
 * Schema for a single cron job in the list response
 */
const cronJobSchema = z.object({
    name: z.string(),
    description: z.string(),
    schedule: z.string(),
    enabled: z.boolean()
});

/**
 * Schema for the cron jobs list response data
 */
const cronJobsListDataSchema = z.object({
    jobs: z.array(cronJobSchema),
    totalJobs: z.number(),
    enabledJobs: z.number()
});

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
    _c: Context<AppBindings>
): Promise<z.infer<typeof cronJobsListDataSchema>> => {
    const jobList = cronJobs.map((job) => ({
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        enabled: job.enabled
    }));

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

    const result: CronJobResult = await Promise.race([job.handler(jobContext), timeoutPromise]);

    const durationMs = Date.now() - startTime;

    apiLogger.info({
        message: `[ADMIN-CRON:${jobName}] Completed`,
        success: result.success,
        processed: result.processed,
        errors: result.errors,
        durationMs,
        dryRun
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
app.route('/', triggerCronJobRoute);

export { app as adminCronRoutes };
