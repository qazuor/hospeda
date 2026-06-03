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
    createdAt: z.coerce.date()
});

/** A single persisted app log entry */
export type AppLogEntry = z.infer<typeof AppLogEntrySchema>;
