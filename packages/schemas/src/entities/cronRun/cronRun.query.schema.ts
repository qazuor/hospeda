import { z } from 'zod';
import { CronRunExecutionModeEnum, CronRunStatusEnum } from './cronRun.schema.js';

/**
 * CronRunFilterSchema
 *
 * Query filter schema for listing cron run records.
 * All filter fields are optional — omitted fields are not applied.
 * Includes pagination via `page` and `pageSize` to prevent unbounded result sets.
 */
export const CronRunFilterSchema = z.object({
    /** Filter by exact job name */
    jobName: z.string().optional(),
    /** Filter by run outcome */
    status: CronRunStatusEnum.optional(),
    /** Filter by how the run was triggered */
    executionMode: CronRunExecutionModeEnum.optional(),
    /** Return only runs that started on or after this date */
    fromDate: z.coerce.date().optional(),
    /** Return only runs that started on or before this date */
    toDate: z.coerce.date().optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().min(1).default(1),
    /** Number of items per page (max 100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Query filter type for listing cron runs */
export type CronRunFilter = z.infer<typeof CronRunFilterSchema>;
