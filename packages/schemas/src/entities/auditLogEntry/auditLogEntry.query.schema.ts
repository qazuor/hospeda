import { z } from 'zod';
import { AuditLogSeverityEnum } from './auditLogEntry.schema.js';

/**
 * Sortable fields for audit/security log entries.
 * Only these two fields are whitelisted to prevent arbitrary column injection.
 */
export const AuditLogEntrySortableField = z.enum(['loggedAt', 'severity']);

/** Validated sort field for audit log entries */
export type AuditLogEntrySortableFieldType = z.infer<typeof AuditLogEntrySortableField>;

/**
 * AuditLogEntrySortInput
 *
 * Validated sort input passed from the route through the service to the model.
 * Keeps field names typed and direction constrained at compile-time.
 */
export const AuditLogEntrySortInputSchema = z.object({
    field: AuditLogEntrySortableField,
    direction: z.enum(['asc', 'desc'])
});

/** Validated sort input for audit log list queries */
export type AuditLogEntrySortInput = z.infer<typeof AuditLogEntrySortInputSchema>;

/**
 * AuditLogEntryFilterSchema
 *
 * Query filter schema for listing audit/security log entries in the admin
 * viewers. All filter fields are optional — omitted fields are not applied.
 *
 * IMPORTANT: `logType` is deliberately NOT a client-supplied filter. Each admin
 * route injects its own `logType` (`'audit'` or `'security'`) so a SUPER_ADMIN
 * holding only one of the two VIEW permissions can never reach the other family
 * by tampering with a query param.
 *
 * Sort: accepted in `field:direction` format (e.g. `loggedAt:desc`). Only
 * `loggedAt` and `severity` are valid field names; invalid values are rejected
 * by Zod so arbitrary column names never reach the DB layer. Default:
 * `loggedAt:desc`.
 */
export const AuditLogEntryFilterSchema = z.object({
    /** Filter by exact event type (e.g. 'auth.login.failed') */
    eventType: z.string().max(50).optional(),
    /** Filter by severity ('info' | 'critical') */
    severity: AuditLogSeverityEnum.optional(),
    /** Filter by exact acting user UUID */
    actorId: z.string().uuid().optional(),
    /** Return only entries logged on or after this date */
    fromDate: z.coerce.date().optional(),
    /** Return only entries logged on or before this date */
    toDate: z.coerce.date().optional(),
    /**
     * Sort order in `field:direction` format.
     * Whitelisted fields: `loggedAt`, `severity`. Direction: `asc` | `desc`.
     * Defaults to `loggedAt:desc`.
     */
    sort: z
        .string()
        .regex(/^(loggedAt|severity):(asc|desc)$/)
        .optional(),
    /** Page number (1-based) */
    page: z.coerce.number().int().min(1).default(1),
    /** Number of items per page (max 100) */
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
});

/** Query filter type for listing audit/security log entries */
export type AuditLogEntryFilter = z.infer<typeof AuditLogEntryFilterSchema>;
