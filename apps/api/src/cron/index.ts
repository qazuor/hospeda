/**
 * Cron System
 * HTTP-first cron job system for scheduled tasks
 * @module cron
 *
 * Architecture:
 * - Jobs are HTTP endpoints that can be triggered externally
 * - Support for multiple adapters: node-cron, Vercel Cron, manual
 * - All jobs authenticated via shared secret
 * - Standardized job interface with context and result types
 *
 * Usage:
 * 1. Define a job in ./jobs/ directory
 * 2. Register job in ./registry.ts
 * 3. Jobs are auto-scheduled based on CRON_ADAPTER
 * 4. Jobs can be triggered via POST /api/v1/cron/:jobName
 *
 * @example
 * ```typescript
 * // Trigger a job manually
 * curl -X POST \
 *   -H "X-Cron-Secret: your-secret" \
 *   http://localhost:3001/api/v1/cron/cleanup-sessions
 * ```
 */

// Export all types
export type { CronJobContext, CronJobDefinition, CronJobHandler, CronJobResult } from './types';

// Export middleware
export { cronAuthMiddleware } from './middleware';

// Export registry functions
export { cronJobs, getCronJob, getEnabledCronJobs } from './registry';

// Export bootstrap function
export { startCronScheduler } from './bootstrap';

// Export routes
export { default as cronRoutes } from './routes';
