import { z } from 'zod';

/**
 * Log levels persisted to `app_log_entries`.
 * Only WARN and ERROR are written by the db-sink hook (volume guard) — the
 * uppercase values match the logger's `LogLevelType`.
 */
export const AppLogEntryLevelEnum = z.enum(['WARN', 'ERROR']);

/** Union type of persisted app log levels */
export type AppLogEntryLevel = z.infer<typeof AppLogEntryLevelEnum>;

/**
 * AppLogEntrySchema
 *
 * A single application log entry persisted by the logger's db-sink hook
 * (SPEC-184 / BETA-82). Append-only observability data surfaced in the admin
 * log viewer. General application logs only — audit/security logs are a
 * separate domain (SPEC-162).
 *
 * Request-context fields (`requestId`, `userId`, `method`, `path`) are nullable
 * because entries emitted outside a request scope (startup, cron) carry no
 * per-request data.
 */
export const AppLogEntrySchema = z.object({
    /** Unique identifier for this log entry */
    id: z.string().uuid(),
    /** Log level (only WARN | ERROR are persisted) */
    level: AppLogEntryLevelEnum,
    /** Category key (e.g. 'API', 'BILLING', 'AUTH') */
    category: z.string().nullable().optional(),
    /** Optional label from the log call */
    label: z.string().nullable().optional(),
    /** Log message (string payloads land here; empty for object payloads) */
    message: z.string(),
    /** Redacted structured payload (already sanitized by the logger) */
    data: z.record(z.string(), z.unknown()).nullable().optional(),
    /** When the log entry was emitted */
    loggedAt: z.coerce.date(),
    /** Timestamp when this row was created */
    createdAt: z.coerce.date(),
    /**
     * Correlation ID from AsyncLocalStorage request context.
     * Null for entries emitted outside a request scope (startup, cron).
     */
    requestId: z.string().max(64).nullable().optional(),
    /**
     * Authenticated user ID at the time of the log entry.
     * Null for unauthenticated requests or non-request-scoped entries.
     */
    userId: z.string().uuid().nullable().optional(),
    /**
     * HTTP method of the in-flight request (e.g. 'GET', 'POST').
     * Null for non-request-scoped entries.
     */
    method: z.string().max(10).nullable().optional(),
    /**
     * Request path (e.g. '/api/v1/public/accommodations').
     * Null for non-request-scoped entries.
     */
    path: z.string().nullable().optional()
});

/** A single persisted app log entry */
export type AppLogEntry = z.infer<typeof AppLogEntrySchema>;
