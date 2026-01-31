/**
 * Cron Job HTTP Routes
 * HTTP endpoints for triggering and managing scheduled jobs
 * @module cron/routes
 */

import { createRouter } from '../utils/create-app';
import { apiLogger } from '../utils/logger';
import { cronAuthMiddleware } from './middleware';
import { cronJobs, getCronJob } from './registry';
import type { CronJobContext, CronJobResult } from './types';

const router = createRouter();

// Apply authentication middleware to all cron routes
router.use('*', cronAuthMiddleware);

/**
 * GET /
 * List all registered cron jobs
 *
 * @returns Array of job information (name, description, schedule, enabled)
 *
 * @example
 * ```bash
 * curl -H "X-Cron-Secret: your-secret" http://localhost:3001/api/v1/cron
 * ```
 */
router.get('/', (c) => {
    const jobList = cronJobs.map((job) => ({
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        enabled: job.enabled
    }));

    return c.json({
        success: true,
        data: {
            jobs: jobList,
            totalJobs: jobList.length,
            enabledJobs: jobList.filter((job) => job.enabled).length
        }
    });
});

/**
 * POST /:jobName
 * Execute a cron job by name
 *
 * @param jobName - Name of the job to execute
 * @query dryRun - If "true", run in dry-run mode (no actual changes)
 *
 * @returns Job execution result
 *
 * @example
 * ```bash
 * # Normal execution
 * curl -X POST \
 *   -H "X-Cron-Secret: your-secret" \
 *   http://localhost:3001/api/v1/cron/cleanup-sessions
 *
 * # Dry-run mode
 * curl -X POST \
 *   -H "X-Cron-Secret: your-secret" \
 *   "http://localhost:3001/api/v1/cron/cleanup-sessions?dryRun=true"
 * ```
 */
router.post('/:jobName', async (c) => {
    const jobName = c.req.param('jobName');
    const dryRun = c.req.query('dryRun') === 'true';

    // Look up job by name
    const job = getCronJob(jobName);

    if (!job) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: `Cron job not found: ${jobName}`
                }
            },
            404
        );
    }

    // Check if job is enabled
    if (!job.enabled) {
        return c.json(
            {
                success: false,
                error: {
                    code: 'JOB_DISABLED',
                    message: `Cron job is disabled: ${jobName}`
                }
            },
            400
        );
    }

    const startTime = Date.now();

    try {
        // Create job context
        const jobContext: CronJobContext = {
            logger: {
                info: (message: string, data?: Record<string, unknown>) => {
                    apiLogger.info({ message: `[CRON:${jobName}] ${message}`, ...data });
                },
                warn: (message: string, data?: Record<string, unknown>) => {
                    apiLogger.warn({ message: `[CRON:${jobName}] ${message}`, ...data });
                },
                error: (message: string, data?: Record<string, unknown>) => {
                    apiLogger.error({ message: `[CRON:${jobName}] ${message}`, ...data });
                },
                debug: (message: string, data?: Record<string, unknown>) => {
                    apiLogger.debug({ message: `[CRON:${jobName}] ${message}`, ...data });
                }
            },
            startedAt: new Date(),
            dryRun
        };

        // Execute with timeout
        const timeoutMs = job.timeoutMs || 30000; // Default 30 seconds
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Job execution timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        const result: CronJobResult = await Promise.race([job.handler(jobContext), timeoutPromise]);

        const duration = Date.now() - startTime;

        apiLogger.info({
            message: `[CRON:${jobName}] Completed`,
            success: result.success,
            processed: result.processed,
            errors: result.errors,
            durationMs: duration,
            dryRun
        });

        return c.json({
            success: true,
            data: {
                ...result,
                jobName,
                dryRun,
                executedAt: jobContext.startedAt.toISOString()
            }
        });
    } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        apiLogger.error({
            message: `[CRON:${jobName}] Failed`,
            error: errorMessage,
            durationMs: duration,
            dryRun
        });

        // Return error result in standard format
        return c.json(
            {
                success: false,
                error: {
                    code: 'JOB_EXECUTION_FAILED',
                    message: errorMessage
                },
                data: {
                    jobName,
                    dryRun,
                    durationMs: duration
                }
            },
            500
        );
    }
});

export default router;
