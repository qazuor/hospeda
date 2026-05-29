import { z } from 'zod';
import { CronRunExecutionModeEnum, CronRunStatusEnum } from './cronRun.schema.js';

/**
 * CreateCronRunSchema
 *
 * Input accepted by `CronRunService.recordRun()` when persisting the outcome of a
 * cron execution. The service generates `id` and `createdAt`, so they are omitted here.
 * `errorMessage` is truncated to 2000 chars by the service (overflow moved to `details`).
 */
export const CreateCronRunSchema = z.object({
    /** Job identifier, matches the registered CronJobDefinition.name */
    jobName: z.string().min(1),
    /** Outcome of the run */
    status: CronRunStatusEnum,
    /** When the job handler started */
    startedAt: z.coerce.date(),
    /** When the job handler finished (or timed out) */
    finishedAt: z.coerce.date(),
    /** Execution duration in milliseconds */
    durationMs: z.number().int().min(0),
    /** Number of items/records processed */
    processed: z.number().int().min(0).default(0),
    /** Number of errors encountered */
    errors: z.number().int().min(0).default(0),
    /** How the run was triggered */
    executionMode: CronRunExecutionModeEnum,
    /** Whether the run was a dry-run */
    dryRun: z.boolean().default(false),
    /** Error message (truncated by the service before insert) */
    errorMessage: z.string().nullable().optional(),
    /** Free-form execution details */
    details: z.record(z.string(), z.unknown()).optional()
});

/** Input type for recording a cron run */
export type CreateCronRun = z.infer<typeof CreateCronRunSchema>;
