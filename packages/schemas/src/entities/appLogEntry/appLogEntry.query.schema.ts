import { z } from 'zod';
import { AppLogEntryLevelEnum } from './appLogEntry.schema.js';

/**
 * Sortable fields for app log entries.
 * Only these two fields are whitelisted to prevent arbitrary column injection.
 */
export const AppLogEntrySortableField = z.enum(['loggedAt', 'level']);

/** Validated sort field for app log entries */
export type AppLogEntrySortableFieldType = z.infer<typeof AppLogEntrySortableField>;

/**
 * AppLogEntrySortInput
 *
 * Validated sort input passed from the route through the service to the model.
 * Keeps field names typed and direction constrained at compile-time.
 */
export const AppLogEntrySortInputSchema = z.object({
    field: AppLogEntrySortableField,
    direction: z.enum(['asc', 'desc'])
});

/** Validated sort input for app log list queries */
export type AppLogEntrySortInput = z.infer<typeof AppLogEntrySortInputSchema>;

/**
 * AppLogEntryFilterSchema
 *
 * Query filter schema for listing app log entries in the admin log viewer.
 * All filter fields are optional — omitted fields are not applied.
 * Includes pagination via `page` and `pageSize` to prevent unbounded result sets.
 *
 * Request-context filters (added in SPEC-184 follow-up):
 * - `requestId`: exact match on the correlation ID (max 64 chars)
 * - `userId`: exact match on the authenticated user UUID
 * - `method`: exact match on the HTTP method (max 10 chars, e.g. 'GET', 'POST')
 * - `path`: case-insensitive substring match on the request path
 *
 * Sort (added in SPEC-184 entity-list migration):
 * - `sort`: accepted in `field:direction` format (e.g. `loggedAt:desc`).
 *   Only `loggedAt` and `level` are valid field names; invalid values are
 *   rejected by Zod so arbitrary column names never reach the DB layer.
 *   Default: `loggedAt:desc`.
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
    /** Filter by exact request correlation ID (max 64 chars) */
    requestId: z.string().max(64).optional(),
    /** Filter by exact authenticated user UUID */
    userId: z.string().uuid().optional(),
    /** Filter by exact HTTP method (max 10 chars, e.g. 'GET', 'POST') */
    method: z.string().max(10).optional(),
    /** Filter by request path substring (case-insensitive contains search) */
    path: z.string().optional(),
    /**
     * Sort order in `field:direction` format.
     * Whitelisted fields: `loggedAt`, `level`. Direction: `asc` | `desc`.
     * Defaults to `loggedAt:desc`.
     */
    sort: z
        .string()
        .regex(/^(loggedAt|level):(asc|desc)$/)
        .optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().min(1).default(1),
    /** Number of items per page (max 100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Query filter type for listing app log entries */
export type AppLogEntryFilter = z.infer<typeof AppLogEntryFilterSchema>;
