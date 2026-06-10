import { z } from 'zod';
import { CronRunSchema } from './cronRun.schema.js';

/**
 * CronRunSummarySchema
 *
 * Aggregated cron health snapshot consumed by the ADMIN dashboard (SPEC-155 card D
 * "crons fallidos / último run"). Combines the latest run per job with the most
 * recent failures across all jobs.
 */
export const CronRunSummarySchema = z.object({
    /** Latest run for each job that has ever recorded a run (one entry per job) */
    lastRuns: z.array(CronRunSchema),
    /** Most recent failed/timeout runs across all jobs, newest first */
    recentFailures: z.array(CronRunSchema),
    /** Number of distinct jobs whose most recent run was not a success */
    failingJobsCount: z.number().int(),
    /** Timestamp when this summary was generated */
    generatedAt: z.coerce.date()
});

/** Aggregated cron run summary for the admin dashboard */
export type CronRunSummary = z.infer<typeof CronRunSummarySchema>;
