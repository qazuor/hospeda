/**
 * Cron Scheduler Bootstrap
 * Initializes and starts the cron scheduler based on environment configuration
 * @module cron/bootstrap
 */

import { apiLogger } from '../utils/logger';
import { getEnabledCronJobs } from './registry';

/**
 * Supported cron adapters
 * - 'node-cron': Uses node-cron library for in-process scheduling
 * - 'vercel': Jobs are triggered externally by Vercel Cron
 * - 'manual': Jobs must be triggered manually via HTTP
 */
type CronAdapter = 'node-cron' | 'vercel' | 'manual';

/**
 * Start the cron scheduler
 * Initializes job scheduling based on CRON_ADAPTER environment variable
 *
 * Environment Variables:
 * - CRON_ADAPTER: Scheduler type ('node-cron', 'vercel', 'manual')
 * - CRON_SECRET: Shared secret for authenticating cron requests
 *
 * @param port - Port number where the API server is running
 *
 * @example
 * ```typescript
 * // In src/index.ts after server starts
 * if (process.env.NODE_ENV !== 'test') {
 *   await startCronScheduler(port);
 * }
 * ```
 */
export const startCronScheduler = async (port: number): Promise<void> => {
    const adapter = (process.env.CRON_ADAPTER || 'manual') as CronAdapter;

    apiLogger.info({ message: '[CRON] Initializing cron scheduler', adapter });

    if (adapter !== 'node-cron') {
        apiLogger.info({
            message: `[CRON] Using ${adapter} adapter - no in-process scheduling needed`
        });
        return;
    }

    // node-cron adapter: schedule jobs in-process
    try {
        // Dynamic import to avoid requiring node-cron as a hard dependency
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodeCron = await import('node-cron');

        const enabledJobs = getEnabledCronJobs();

        if (enabledJobs.length === 0) {
            apiLogger.warn({ message: '[CRON] No enabled jobs found - scheduler not started' });
            return;
        }

        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            apiLogger.error({
                message: '[CRON] CRON_SECRET not configured - cannot schedule jobs'
            });
            return;
        }

        // Schedule each enabled job
        for (const job of enabledJobs) {
            try {
                nodeCron.schedule(job.schedule, async () => {
                    apiLogger.info({ message: `[CRON] Triggering scheduled job: ${job.name}` });

                    try {
                        // Call the job endpoint via HTTP
                        const response = await fetch(
                            `http://localhost:${port}/api/v1/cron/${job.name}`,
                            {
                                method: 'POST',
                                headers: {
                                    'X-Cron-Secret': cronSecret,
                                    'Content-Type': 'application/json'
                                }
                            }
                        );

                        if (response.ok) {
                            const result = await response.json();
                            apiLogger.info({
                                message: `[CRON] Job completed: ${job.name}`,
                                result
                            });
                        } else {
                            const errorText = await response.text();
                            apiLogger.error({
                                message: `[CRON] Job failed: ${job.name}`,
                                status: response.status,
                                error: errorText
                            });
                        }
                    } catch (error) {
                        const errorMessage =
                            error instanceof Error ? error.message : 'Unknown error';
                        apiLogger.error({
                            message: `[CRON] Failed to trigger job: ${job.name}`,
                            error: errorMessage
                        });
                    }
                });

                apiLogger.info({
                    message: `[CRON] Scheduled job: ${job.name}`,
                    schedule: job.schedule,
                    description: job.description
                });
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                apiLogger.error({
                    message: `[CRON] Failed to schedule job: ${job.name}`,
                    error: errorMessage
                });
            }
        }

        apiLogger.info({ message: `[CRON] Scheduler started with ${enabledJobs.length} jobs` });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // If node-cron is not installed, provide helpful error message
        if (errorMessage.includes('Cannot find module')) {
            apiLogger.warn({
                message:
                    '[CRON] node-cron not installed - in-process scheduling disabled. ' +
                    'Install with: pnpm add -D node-cron @types/node-cron'
            });
        } else {
            apiLogger.error({ message: '[CRON] Failed to start scheduler', error: errorMessage });
        }
    }
};
