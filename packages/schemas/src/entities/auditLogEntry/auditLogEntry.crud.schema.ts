import { z } from 'zod';
import { AuditLogSeverityEnum, AuditLogTypeEnum } from './auditLogEntry.schema.js';

/** Maximum length of the persisted `message`; overflow is moved into `data`. */
export const AUDIT_LOG_MESSAGE_MAX_LENGTH = 2000;

/**
 * CreateAuditLogEntrySchema
 *
 * Input accepted by `AuditLogEntryService.recordEntry()` when the audit-logger's
 * persister stores an event (SPEC-162). The service generates `id` and
 * `createdAt`, so they are omitted here. `message` is truncated to
 * {@link AUDIT_LOG_MESSAGE_MAX_LENGTH} chars by the service (overflow moved to
 * `data.messageFull`).
 *
 * Context fields are optional: each originating event type supplies a different
 * subset.
 */
export const CreateAuditLogEntrySchema = z.object({
    /** Event family: 'audit' | 'security' */
    logType: AuditLogTypeEnum,
    /** The AuditEventType value */
    eventType: z.string().max(50),
    /** Severity ('info' | 'critical') */
    severity: AuditLogSeverityEnum,
    /** Acting user UUID. Omit for unauthenticated security events. */
    actorId: z.string().uuid().nullable().optional(),
    /** Actor role at event time. */
    actorRole: z.string().max(50).nullable().optional(),
    /** Target user / resource id. */
    targetId: z.string().max(255).nullable().optional(),
    /** Client IP for security events. */
    ip: z.string().max(64).nullable().optional(),
    /** HTTP method of the in-flight request. */
    method: z.string().max(10).nullable().optional(),
    /** Request / resource path. */
    path: z.string().nullable().optional(),
    /** HTTP status code, when applicable. */
    statusCode: z.number().int().nullable().optional(),
    /** Human-readable summary (truncated by the service before insert). */
    message: z.string(),
    /** Full redacted entry (already scrubbed by audit-logger). */
    data: z.record(z.string(), z.unknown()).optional(),
    /** When the event occurred. */
    loggedAt: z.coerce.date()
});

/** Input type for recording an audit/security log entry */
export type CreateAuditLogEntry = z.infer<typeof CreateAuditLogEntrySchema>;
