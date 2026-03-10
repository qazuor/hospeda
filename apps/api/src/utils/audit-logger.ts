/**
 * Structured audit logging utility for security-sensitive operations.
 * Uses a dedicated AUDIT logger category for easy filtering and compliance.
 *
 * @module audit-logger
 */

import { LoggerColors, logger } from '@repo/logger';

/** Dedicated AUDIT logger category */
const auditLogger = logger.registerCategory('AUDIT', 'AUDIT', {
    color: LoggerColors.RED
});

/**
 * Audit event type constants.
 * Each event type corresponds to a specific security-sensitive operation.
 */
export const AuditEventType = {
    AUTH_LOGIN_FAILED: 'auth.login.failed',
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOCKOUT: 'auth.lockout',
    ACCESS_DENIED: 'access.denied',
    BILLING_MUTATION: 'billing.mutation',
    PERMISSION_CHANGE: 'permission.change',
    SESSION_SIGNOUT: 'session.signout'
} as const;

export type AuditEventTypeValue = (typeof AuditEventType)[keyof typeof AuditEventType];

/** Base fields present in every audit entry */
interface BaseAuditEntry {
    readonly auditEvent: AuditEventTypeValue;
    readonly timestamp?: string;
}

interface AuthLoginFailedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_FAILED;
    readonly email: string;
    readonly ip: string;
    readonly reason: string;
    readonly attemptNumber: number;
    readonly locked: boolean;
}

interface AuthLoginSuccessEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOGIN_SUCCESS;
    readonly email: string;
    readonly ip: string;
}

interface AuthLockoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.AUTH_LOCKOUT;
    readonly email: string;
    readonly ip: string;
    readonly attemptNumber: number;
    readonly retryAfter: number;
}

interface AccessDeniedEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.ACCESS_DENIED;
    readonly actorId: string;
    readonly actorRole: string;
    readonly resource: string;
    readonly method: string;
    readonly statusCode: number;
    readonly reason: string;
    readonly requiredPermissions?: readonly string[];
}

interface BillingMutationEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.BILLING_MUTATION;
    readonly actorId: string;
    readonly action: 'create' | 'update' | 'delete';
    readonly resourceType: string;
    readonly resourceId: string;
}

interface PermissionChangeEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.PERMISSION_CHANGE;
    readonly actorId: string;
    readonly targetUserId: string;
    readonly changeType: 'role_assignment' | 'permission_grant' | 'permission_revoke';
    readonly oldValue: string;
    readonly newValue: string;
}

interface SessionSignoutEntry extends BaseAuditEntry {
    readonly auditEvent: typeof AuditEventType.SESSION_SIGNOUT;
    readonly actorId: string;
    readonly ip: string;
}

/** Discriminated union of all audit entry types */
export type AuditEntry =
    | AuthLoginFailedEntry
    | AuthLoginSuccessEntry
    | AuthLockoutEntry
    | AccessDeniedEntry
    | BillingMutationEntry
    | PermissionChangeEntry
    | SessionSignoutEntry;

/** Regex pattern matching sensitive field names that must be redacted */
const SENSITIVE_PATTERNS = /password|token|secret|session_id|cookie|authorization|credential/i;

/**
 * Scrub sensitive top-level fields from an audit entry.
 * Only checks top-level field names (documented limitation).
 */
function scrubSensitiveData(entry: Record<string, unknown>): Record<string, unknown> {
    const scrubbed = { ...entry };
    for (const key of Object.keys(scrubbed)) {
        if (SENSITIVE_PATTERNS.test(key)) {
            scrubbed[key] = '[REDACTED]';
        }
    }
    return scrubbed;
}

/**
 * Write a structured audit log entry.
 * Timestamp is auto-generated if not provided.
 * Sensitive fields are automatically redacted.
 */
export function auditLog(entry: AuditEntry): void {
    const fullEntry = {
        ...entry,
        timestamp: entry.timestamp ?? new Date().toISOString()
    };
    const scrubbed = scrubSensitiveData(fullEntry as unknown as Record<string, unknown>);
    auditLogger.info(scrubbed, `AUDIT:${entry.auditEvent}`);
}
