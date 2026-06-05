import { z } from 'zod';
import { AppLogEntryLevelEnum } from './appLogEntry.schema.js';

/** Maximum length of the persisted `message`; overflow is moved into `data`. */
export const APP_LOG_MESSAGE_MAX_LENGTH = 2000;

/**
 * CreateAppLogEntrySchema
 *
 * Input accepted by `AppLogEntryService.recordEntry()` when the db-sink hook
 * persists a WARN/ERROR log entry. The service generates `id` and `createdAt`,
 * so they are omitted here. `message` is truncated to
 * {@link APP_LOG_MESSAGE_MAX_LENGTH} chars by the service (overflow moved to
 * `data.messageFull`).
 *
 * Request-context fields (`requestId`, `userId`, `method`, `path`) are optional:
 * entries emitted outside a request scope (startup, cron) should simply omit them.
 */
export const CreateAppLogEntrySchema = z.object({
    /** Log level (only WARN | ERROR are persisted) */
    level: AppLogEntryLevelEnum,
    /** Category key (e.g. 'API', 'BILLING', 'AUTH') */
    category: z.string().max(50).nullable().optional(),
    /** Optional label from the log call */
    label: z.string().nullable().optional(),
    /** Log message (truncated by the service before insert) */
    message: z.string(),
    /** Redacted structured payload (already sanitized by the logger) */
    data: z.record(z.string(), z.unknown()).optional(),
    /** When the log entry was emitted */
    loggedAt: z.coerce.date(),
    /**
     * Correlation ID from AsyncLocalStorage request context.
     * Omit for non-request-scoped entries.
     */
    requestId: z.string().max(64).optional(),
    /**
     * Authenticated user ID at the time of the log entry.
     * Omit for unauthenticated requests or non-request-scoped entries.
     */
    userId: z.string().uuid().optional(),
    /**
     * HTTP method of the in-flight request (e.g. 'GET', 'POST').
     * Omit for non-request-scoped entries.
     */
    method: z.string().max(10).optional(),
    /**
     * Request path (e.g. '/api/v1/public/accommodations').
     * Omit for non-request-scoped entries.
     */
    path: z.string().optional()
});

/** Input type for recording an app log entry */
export type CreateAppLogEntry = z.infer<typeof CreateAppLogEntrySchema>;
