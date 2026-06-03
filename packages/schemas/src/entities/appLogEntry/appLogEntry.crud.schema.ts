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
    loggedAt: z.coerce.date()
});

/** Input type for recording an app log entry */
export type CreateAppLogEntry = z.infer<typeof CreateAppLogEntrySchema>;
