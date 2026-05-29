import { z } from 'zod';

/**
 * Outcome of a single cron job execution.
 * - `success`: The job handler completed without raising.
 * - `failed`: The job handler raised, or reported `success: false`.
 * - `timeout`: The job exceeded its configured `timeoutMs` and was aborted.
 */
export const CronRunStatusEnum = z.enum(['success', 'failed', 'timeout']);

/** Union type of all supported cron run statuses */
export type CronRunStatus = z.infer<typeof CronRunStatusEnum>;

/**
 * How a cron run was triggered.
 * - `scheduled`: Fired automatically by the scheduler (node-cron / external).
 * - `manual`: Fired via the cron-admin trigger endpoint.
 */
export const CronRunExecutionModeEnum = z.enum(['scheduled', 'manual']);

/** Union type of all supported cron run execution modes */
export type CronRunExecutionMode = z.infer<typeof CronRunExecutionModeEnum>;

/**
 * CronRunSchema
 *
 * Records the outcome of a single cron job execution (scheduled or manual).
 * Append-only log used for admin observability: last run per job + recent failures.
 */
export const CronRunSchema = z.object({
    /** Unique identifier for this run record */
    id: z.string().uuid(),
    /** Job identifier, matches the registered CronJobDefinition.name */
    jobName: z.string(),
    /** Outcome of the run */
    status: CronRunStatusEnum,
    /** When the job handler started */
    startedAt: z.coerce.date(),
    /** When the job handler finished (or timed out) */
    finishedAt: z.coerce.date(),
    /** Execution duration in milliseconds */
    durationMs: z.number().int(),
    /** Number of items/records processed */
    processed: z.number().int(),
    /** Number of errors encountered */
    errors: z.number().int(),
    /** How the run was triggered */
    executionMode: CronRunExecutionModeEnum,
    /** Whether the run was a dry-run */
    dryRun: z.boolean(),
    /** Truncated error message (<= 2000 chars); overflow lives in `details` */
    errorMessage: z.string().nullable().optional(),
    /** Free-form execution details (from CronJobResult.details + any overflow) */
    details: z.record(z.string(), z.unknown()).nullable().optional(),
    /** Timestamp when this run record was created */
    createdAt: z.coerce.date()
});

/** A single cron run record */
export type CronRun = z.infer<typeof CronRunSchema>;
