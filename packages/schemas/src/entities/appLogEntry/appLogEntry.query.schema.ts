import { z } from 'zod';
import { AppLogEntryLevelEnum } from './appLogEntry.schema.js';

/**
 * AppLogEntryFilterSchema
 *
 * Query filter schema for listing app log entries in the admin log viewer.
 * All filter fields are optional — omitted fields are not applied.
 * Includes pagination via `page` and `pageSize` to prevent unbounded result sets.
 */
export const AppLogEntryFilterSchema = z.object({
    /** Filter by log level */
    level: AppLogEntryLevelEnum.optional(),
    /** Filter by exact category key */
    category: z.string().optional(),
    /** Return only entries logged on or after this date */
    fromDate: z.coerce.date().optional(),
    /** Return only entries logged on or before this date */
    toDate: z.coerce.date().optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().min(1).default(1),
    /** Number of items per page (max 100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Query filter type for listing app log entries */
export type AppLogEntryFilter = z.infer<typeof AppLogEntryFilterSchema>;
