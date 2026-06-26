import { z } from 'zod';

/**
 * Event family discriminator for `audit_log_entries` (SPEC-162).
 * - `audit`    — admin actions (billing/permission/user/route mutations)
 * - `security` — auth events (login, lockout, access denied, signout)
 */
export const AuditLogTypeEnum = z.enum(['audit', 'security']);

/** Union type of the audit log family discriminator */
export type AuditLogType = z.infer<typeof AuditLogTypeEnum>;

/**
 * Severity of an audit/security event.
 * `critical` mirrors the audit-logger's CRITICAL_AUDIT_EVENTS set; everything
 * else is `info`. Analog of `app_log_entries.level`.
 */
export const AuditLogSeverityEnum = z.enum(['info', 'critical']);

/** Union type of audit log severities */
export type AuditLogSeverity = z.infer<typeof AuditLogSeverityEnum>;

/**
 * AuditLogEntrySchema
 *
 * A single persisted audit or security event (SPEC-162). Append-only
 * observability data surfaced in the admin audit/security log viewers.
 *
 * Context fields (`actorId`, `actorRole`, `targetId`, `ip`, `method`, `path`,
 * `statusCode`) are nullable because the originating event types carry different
 * subsets of them (e.g. a failed login has `ip` but no `actorId`).
 */
export const AuditLogEntrySchema = z.object({
    /** Unique identifier for this log entry */
    id: z.string().uuid(),
    /** Event family: 'audit' | 'security' */
    logType: AuditLogTypeEnum,
    /** The AuditEventType value (e.g. 'auth.login.failed') */
    eventType: z.string(),
    /** Severity ('info' | 'critical') */
    severity: AuditLogSeverityEnum,
    /** Acting user UUID. Null for unauthenticated security events. */
    actorId: z.string().uuid().nullable().optional(),
    /** Actor role at event time (e.g. 'ADMIN', 'guest'). */
    actorRole: z.string().nullable().optional(),
    /** Target user / resource id. */
    targetId: z.string().nullable().optional(),
    /** Client IP for security events. */
    ip: z.string().nullable().optional(),
    /** HTTP method of the in-flight request. */
    method: z.string().max(10).nullable().optional(),
    /** Request / resource path. */
    path: z.string().nullable().optional(),
    /** HTTP status code, when applicable. */
    statusCode: z.number().int().nullable().optional(),
    /** Human-readable summary of the event. */
    message: z.string(),
    /** Full redacted entry (already scrubbed by audit-logger). */
    data: z.record(z.string(), z.unknown()).nullable().optional(),
    /** When the event occurred. */
    loggedAt: z.coerce.date(),
    /** Timestamp when this row was created. */
    createdAt: z.coerce.date()
});

/** A single persisted audit/security log entry */
export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
