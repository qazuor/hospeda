/**
 * Cron System
 *
 * In-process cron job runner. Scheduled jobs are registered in
 * {@link ./registry.ts} and dispatched by {@link ./bootstrap.ts} via
 * `node-cron`. Job handlers run inside the API process — there are no
 * HTTP cron endpoints in production.
 *
 * Manual triggers (admin panel, operator one-shots) live under
 * `/api/v1/admin/cron/*` and use the standard admin auth path; see
 * `apps/api/src/routes/cron-admin/`.
 *
 * @module cron
 *
 * Usage:
 * 1. Define a job in ./jobs/ directory
 * 2. Register the job in ./registry.ts
 * 3. The scheduler picks it up automatically when
 *    `HOSPEDA_CRON_ADAPTER=node-cron` and the API boots.
 */

// Export all types
export type { CronJobContext, CronJobDefinition, CronJobHandler, CronJobResult } from './types';

// Export registry functions
export { cronJobs, getCronJob, getEnabledCronJobs } from './registry';

// Export bootstrap function
export { startCronScheduler } from './bootstrap';
